//! ForceAtlas2 graph layout (Jacomy et al., 2014) with Barnes–Hut repulsion.
//!
//! Deterministic: start positions come from a hash of each node's key (or
//! from the previous build's positions), nodes are visited in index order,
//! and only IEEE-exact operations (`+ - * / sqrt`) touch positions, so native
//! and WebAssembly builds produce the same numbers.
//!
//! Warm start: when positions from the last build are given, known nodes keep
//! them, new nodes start at the mean of their placed neighbours, and the
//! layout runs fewer iterations, so adding a note barely moves the others.

use crate::text::hash64;

/// A warm start only settles new nodes and their neighbours; capping the speed keeps the rest in place.
const WARM_MAX_SPEED: f64 = 0.05;

pub struct Params {
    pub iterations: usize,
    /// Repulsion strength (`kr`).
    pub scaling: f64,
    pub gravity: f64,
    /// Barnes–Hut accuracy: larger is faster and coarser.
    pub theta: f64,
    pub jitter_tolerance: f64,
}

impl Params {
    pub fn for_size(n: usize, warm: bool) -> Params {
        let iterations = match (n, warm) {
            (_, true) => 30,
            (0..=500, false) => 300,
            (501..=5000, false) => 150,
            _ => 100,
        };
        Params {
            iterations,
            scaling: if n > 100 { 2.0 } else { 10.0 },
            gravity: 1.0,
            theta: 1.2,
            jitter_tolerance: 1.0,
        }
    }
}

/// Undirected weighted edges between node indices.
pub struct Input<'a> {
    pub keys: &'a [String],
    pub edges: &'a [(u32, u32, f64)],
    /// Community of each node, for spreading the start positions (`u32::MAX` = none).
    pub cluster: &'a [u32],
    /// Positions from the previous build, by node index.
    pub previous: &'a [Option<(f64, f64)>],
}

fn unit(h: u64) -> f64 {
    (h >> 11) as f64 / (1u64 << 53) as f64
}

/// Initial positions: previous ones, else near placed neighbours, else around the node's cluster anchor.
fn start(input: &Input) -> (Vec<f64>, Vec<f64>, bool) {
    let n = input.keys.len();
    let mut x = vec![0.0; n];
    let mut y = vec![0.0; n];
    let mut placed = vec![false; n];
    let mut known = 0usize;
    for i in 0..n {
        if let Some(Some((px, py))) = input.previous.get(i) {
            x[i] = *px;
            y[i] = *py;
            placed[i] = true;
            known += 1;
        }
    }
    // Mostly known nodes: a gentle warm run. Many new ones: a full run from the known positions.
    let warm = known > 0 && known * 5 >= n * 4;
    let mut adj: Vec<Vec<u32>> = vec![Vec::new(); n];
    for &(a, b, _) in input.edges {
        adj[a as usize].push(b);
        adj[b as usize].push(a);
    }
    let k = input
        .cluster
        .iter()
        .filter(|&&c| c != u32::MAX)
        .max()
        .map(|&c| c as usize + 1)
        .unwrap_or(1);
    let spread = (n as f64).sqrt() * 8.0 + 10.0;
    for i in 0..n {
        if placed[i] {
            continue;
        }
        let h = hash64(input.keys[i].as_bytes());
        let jx = unit(h) - 0.5;
        let jy = unit(hash64(&h.to_le_bytes())) - 0.5;
        let near: Vec<u32> = adj[i]
            .iter()
            .copied()
            .filter(|&j| placed[j as usize])
            .collect();
        if known > 0 && !near.is_empty() {
            let mut sx = 0.0;
            let mut sy = 0.0;
            for &j in &near {
                sx += x[j as usize];
                sy += y[j as usize];
            }
            x[i] = sx / near.len() as f64 + jx * 4.0;
            y[i] = sy / near.len() as f64 + jy * 4.0;
        } else {
            let c = input.cluster.get(i).copied().unwrap_or(u32::MAX);
            let (ax, ay) = if c == u32::MAX || k <= 1 {
                (0.0, 0.0)
            } else {
                let a = core::f64::consts::TAU * c as f64 / k as f64;
                (libm::cos(a) * spread, libm::sin(a) * spread)
            };
            let r = if known > 0 {
                spread * 0.3
            } else {
                spread * 0.6
            };
            x[i] = ax + jx * r;
            y[i] = ay + jy * r;
        }
        placed[i] = true;
    }
    (x, y, warm)
}

/// Barnes–Hut region over a slice of node indices.
struct Region {
    mass: f64,
    cx: f64,
    cy: f64,
    size: f64,
    start: usize,
    end: usize,
    children: [u32; 4],
}

const NONE: u32 = u32::MAX;

struct Tree {
    regions: Vec<Region>,
    order: Vec<u32>,
}

impl Tree {
    fn build(x: &[f64], y: &[f64], mass: &[f64]) -> Tree {
        let mut t = Tree {
            regions: Vec::new(),
            order: (0..x.len() as u32).collect(),
        };
        if !x.is_empty() {
            t.region(x, y, mass, 0, x.len(), 0);
        }
        t
    }

    fn region(
        &mut self,
        x: &[f64],
        y: &[f64],
        m: &[f64],
        start: usize,
        end: usize,
        depth: u32,
    ) -> u32 {
        let mut mass = 0.0;
        let mut sx = 0.0;
        let mut sy = 0.0;
        for &i in &self.order[start..end] {
            let i = i as usize;
            mass += m[i];
            sx += x[i] * m[i];
            sy += y[i] * m[i];
        }
        let cx = sx / mass;
        let cy = sy / mass;
        let mut size = 0.0f64;
        for &i in &self.order[start..end] {
            let i = i as usize;
            let d = ((x[i] - cx) * (x[i] - cx) + (y[i] - cy) * (y[i] - cy)).sqrt();
            size = size.max(2.0 * d);
        }
        let id = self.regions.len() as u32;
        self.regions.push(Region {
            mass,
            cx,
            cy,
            size,
            start,
            end,
            children: [NONE; 4],
        });
        if end - start <= 1 || depth >= 48 || size == 0.0 {
            return id;
        }
        let quad = |i: u32| -> u8 {
            let i = i as usize;
            (if x[i] < cx { 0 } else { 1 }) + (if y[i] < cy { 0 } else { 2 })
        };
        self.order[start..end].sort_by_key(|&i| quad(i));
        let mut bounds = [start; 5];
        let mut k = start;
        for (q, b) in bounds.iter_mut().enumerate().skip(1) {
            while k < end && quad(self.order[k]) < q as u8 {
                k += 1;
            }
            *b = k;
        }
        bounds[4] = end;
        // All nodes in one quadrant means no progress: keep this as a leaf.
        if (0..4).any(|q| bounds[q + 1] - bounds[q] == end - start) {
            return id;
        }
        for q in 0..4 {
            if bounds[q + 1] > bounds[q] {
                let child = self.region(x, y, m, bounds[q], bounds[q + 1], depth + 1);
                self.regions[id as usize].children[q] = child;
            }
        }
        id
    }

    /// Repulsion on node `n` from region `r`.
    #[allow(clippy::too_many_arguments)]
    fn repulse(
        &self,
        r: u32,
        n: usize,
        x: &[f64],
        y: &[f64],
        m: &[f64],
        theta: f64,
        kr: f64,
        out: &mut (f64, f64),
    ) {
        let reg = &self.regions[r as usize];
        let leaf = reg.children.iter().all(|&c| c == NONE);
        if leaf {
            for &j in &self.order[reg.start..reg.end] {
                let j = j as usize;
                if j == n {
                    continue;
                }
                let dx = x[n] - x[j];
                let dy = y[n] - y[j];
                let d2 = dx * dx + dy * dy;
                if d2 > 0.0 {
                    let f = kr * m[n] * m[j] / d2;
                    out.0 += dx * f;
                    out.1 += dy * f;
                }
            }
            return;
        }
        let dx = x[n] - reg.cx;
        let dy = y[n] - reg.cy;
        let d = (dx * dx + dy * dy).sqrt();
        if d * theta > reg.size {
            let f = kr * m[n] * reg.mass / (d * d);
            out.0 += dx * f;
            out.1 += dy * f;
        } else {
            for &c in &reg.children {
                if c != NONE {
                    self.repulse(c, n, x, y, m, theta, kr, out);
                }
            }
        }
    }
}

/// Positions for every node. Coordinates are rounded to 1/100 so output is compact and stable.
pub fn forceatlas2(input: &Input, params: Option<Params>) -> Vec<(f64, f64)> {
    let n = input.keys.len();
    if n == 0 {
        return Vec::new();
    }
    let (mut x, mut y, warm) = start(input);
    let p = params.unwrap_or_else(|| Params::for_size(n, warm));
    let mut degree = vec![0.0; n];
    for &(a, b, _) in input.edges {
        degree[a as usize] += 1.0;
        degree[b as usize] += 1.0;
    }
    let mass: Vec<f64> = degree.iter().map(|d| d + 1.0).collect();
    let mut old_dx = vec![0.0; n];
    let mut old_dy = vec![0.0; n];
    let mut speed = 1.0;
    let mut speed_efficiency = 1.0;
    // A warm start begins slowly so placed nodes do not jump.
    if warm {
        speed = 0.1;
    }
    for _ in 0..p.iterations {
        let tree = Tree::build(&x, &y, &mass);
        let mut dx = vec![0.0; n];
        let mut dy = vec![0.0; n];
        for i in 0..n {
            let mut f = (0.0, 0.0);
            tree.repulse(0, i, &x, &y, &mass, p.theta, p.scaling, &mut f);
            dx[i] += f.0;
            dy[i] += f.1;
            // Gravity towards the origin.
            let d = (x[i] * x[i] + y[i] * y[i]).sqrt();
            if d > 0.0 {
                let g = mass[i] * p.gravity / d;
                dx[i] -= x[i] * g;
                dy[i] -= y[i] * g;
            }
        }
        for &(a, b, w) in input.edges {
            let (a, b) = (a as usize, b as usize);
            let ex = x[a] - x[b];
            let ey = y[a] - y[b];
            dx[a] -= ex * w;
            dy[a] -= ey * w;
            dx[b] += ex * w;
            dy[b] += ey * w;
        }
        // Adaptive speed (as in Gephi's implementation).
        let mut swinging = 0.0;
        let mut traction = 0.0;
        for i in 0..n {
            let sx = dx[i] - old_dx[i];
            let sy = dy[i] - old_dy[i];
            swinging += mass[i] * (sx * sx + sy * sy).sqrt();
            let tx = dx[i] + old_dx[i];
            let ty = dy[i] + old_dy[i];
            traction += mass[i] * 0.5 * (tx * tx + ty * ty).sqrt();
        }
        let optimal = 0.05 * (n as f64).sqrt();
        let min_jt = optimal.sqrt();
        let mut jt = p.jitter_tolerance
            * min_jt.max(10.0f64.min(optimal * traction / (n as f64 * n as f64)));
        if traction > 0.0 && swinging / traction > 2.0 {
            if speed_efficiency > 0.05 {
                speed_efficiency *= 0.5;
            }
            jt = jt.max(p.jitter_tolerance);
        }
        if swinging > 0.0 {
            let target = jt * speed_efficiency * traction / swinging;
            if swinging > jt * traction {
                if speed_efficiency > 0.05 {
                    speed_efficiency *= 0.7;
                }
            } else if speed < 1000.0 {
                speed_efficiency *= 1.3;
            }
            speed += (target - speed).min(0.5 * speed);
            if warm {
                speed = speed.min(WARM_MAX_SPEED);
            }
        }
        for i in 0..n {
            let sx = dx[i] - old_dx[i];
            let sy = dy[i] - old_dy[i];
            let swing = mass[i] * (sx * sx + sy * sy).sqrt();
            let factor = speed / (1.0 + (speed * swing).sqrt());
            x[i] += dx[i] * factor;
            y[i] += dy[i] * factor;
        }
        old_dx = dx;
        old_dy = dy;
    }
    let round = |v: f64| (v * 100.0).round() / 100.0;
    x.iter()
        .zip(&y)
        .map(|(&a, &b)| (round(a), round(b)))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    type Fixture = (Vec<String>, Vec<(u32, u32, f64)>, Vec<u32>);

    fn ring_of_cliques() -> Fixture {
        let mut keys = Vec::new();
        let mut edges = Vec::new();
        let mut cluster = Vec::new();
        for c in 0..4u32 {
            for k in 0..6u32 {
                keys.push(format!("n{c}-{k}"));
                cluster.push(c);
                for j in 0..k {
                    edges.push((c * 6 + j, c * 6 + k, 1.0));
                }
            }
            edges.push((c * 6, ((c + 1) % 4) * 6, 1.0));
        }
        (keys, edges, cluster)
    }

    fn dist(a: (f64, f64), b: (f64, f64)) -> f64 {
        ((a.0 - b.0).powi(2) + (a.1 - b.1).powi(2)).sqrt()
    }

    #[test]
    fn deterministic_and_separates_communities() {
        let (keys, edges, cluster) = ring_of_cliques();
        let prev = vec![None; keys.len()];
        let input = Input {
            keys: &keys,
            edges: &edges,
            cluster: &cluster,
            previous: &prev,
        };
        let a = forceatlas2(&input, None);
        let b = forceatlas2(&input, None);
        assert_eq!(a, b);
        // Mean distance inside a clique is well below the mean distance between cliques.
        let (mut inside, mut ni, mut across, mut na) = (0.0, 0, 0.0, 0);
        for i in 0..keys.len() {
            for j in (i + 1)..keys.len() {
                let d = dist(a[i], a[j]);
                if cluster[i] == cluster[j] {
                    inside += d;
                    ni += 1;
                } else {
                    across += d;
                    na += 1;
                }
            }
        }
        assert!(inside / ni as f64 * 2.0 < across / na as f64);
    }

    #[test]
    fn warm_start_keeps_positions() {
        let (mut keys, mut edges, mut cluster) = ring_of_cliques();
        let prev = vec![None; keys.len()];
        let first = forceatlas2(
            &Input {
                keys: &keys,
                edges: &edges,
                cluster: &cluster,
                previous: &prev,
            },
            None,
        );
        // Add one node linked to node 0.
        keys.push("new".into());
        cluster.push(0);
        edges.push((0, keys.len() as u32 - 1, 1.0));
        let mut prev: Vec<Option<(f64, f64)>> = first.iter().map(|&p| Some(p)).collect();
        prev.push(None);
        let second = forceatlas2(
            &Input {
                keys: &keys,
                edges: &edges,
                cluster: &cluster,
                previous: &prev,
            },
            None,
        );
        let extent = first
            .iter()
            .map(|&p| dist(p, (0.0, 0.0)))
            .fold(0.0, f64::max);
        let moved: f64 = first
            .iter()
            .zip(&second)
            .map(|(&a, &b)| dist(a, b))
            .sum::<f64>()
            / first.len() as f64;
        assert!(moved < extent * 0.1, "moved {moved} of extent {extent}");
    }
}
