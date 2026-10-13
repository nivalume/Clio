//! Graph algorithms over notes numbered 0..n: PageRank and Louvain community
//! detection. Both are deterministic: nodes are visited in index order, ties
//! go to the smaller index, and floating-point sums run in a fixed order.

/// Undirected weighted adjacency built from directed edges (weights add up).
pub struct Graph {
    pub n: usize,
    /// For each node, (neighbour, weight), sorted by neighbour.
    pub adj: Vec<Vec<(u32, f64)>>,
    /// Directed out-neighbours, for PageRank.
    pub out: Vec<Vec<u32>>,
}

impl Graph {
    pub fn new(n: usize, edges: &[(u32, u32)]) -> Self {
        let mut out = vec![Vec::new(); n];
        let mut pairs: Vec<(u32, u32)> = Vec::with_capacity(edges.len() * 2);
        for &(a, b) in edges {
            if a == b || a as usize >= n || b as usize >= n {
                continue;
            }
            out[a as usize].push(b);
            pairs.push((a, b));
            pairs.push((b, a));
        }
        for o in &mut out {
            o.sort_unstable();
            o.dedup();
        }
        pairs.sort_unstable();
        let mut adj = vec![Vec::new(); n];
        let mut i = 0;
        while i < pairs.len() {
            let (a, b) = pairs[i];
            let mut w = 0.0;
            while i < pairs.len() && pairs[i] == (a, b) {
                w += 1.0;
                i += 1;
            }
            adj[a as usize].push((b, w));
        }
        Graph { n, adj, out }
    }
}

/// PageRank with damping 0.85; dangling nodes spread their rank evenly.
pub fn pagerank(g: &Graph, iterations: usize) -> Vec<f64> {
    let n = g.n;
    if n == 0 {
        return Vec::new();
    }
    let d = 0.85;
    let mut rank = vec![1.0 / n as f64; n];
    let mut next = vec![0.0; n];
    for _ in 0..iterations {
        let mut dangling = 0.0;
        for (i, r) in rank.iter().enumerate() {
            if g.out[i].is_empty() {
                dangling += r;
            }
        }
        let base = (1.0 - d) / n as f64 + d * dangling / n as f64;
        next.iter_mut().for_each(|x| *x = base);
        for (i, r) in rank.iter().enumerate() {
            let outs = &g.out[i];
            if outs.is_empty() {
                continue;
            }
            let share = d * r / outs.len() as f64;
            for &j in outs {
                next[j as usize] += share;
            }
        }
        std::mem::swap(&mut rank, &mut next);
    }
    rank
}

/// Louvain modularity optimisation. Returns a community index per node,
/// numbered by community size (largest first), ties by smallest member.
pub fn louvain(g: &Graph) -> Vec<u32> {
    let n = g.n;
    if n == 0 {
        return Vec::new();
    }
    // `membership[i]` maps original node i to its node in the current level.
    let mut membership: Vec<u32> = (0..n as u32).collect();
    let mut adj = g.adj.clone();
    loop {
        let (comm, moved) = one_level(&adj);
        // Renumber communities densely in order of first appearance.
        let mut remap = vec![u32::MAX; adj.len()];
        let mut next = 0u32;
        for &c in &comm {
            if remap[c as usize] == u32::MAX {
                remap[c as usize] = next;
                next += 1;
            }
        }
        for m in membership.iter_mut() {
            *m = remap[comm[*m as usize] as usize];
        }
        if !moved || next as usize == adj.len() {
            break;
        }
        // Aggregate: one node per community, weights summed, self-loops kept.
        let k = next as usize;
        let mut agg: Vec<Vec<(u32, f64)>> = vec![Vec::new(); k];
        for (i, nbrs) in adj.iter().enumerate() {
            let ci = remap[comm[i] as usize];
            for &(j, w) in nbrs {
                let cj = remap[comm[j as usize] as usize];
                agg[ci as usize].push((cj, w));
            }
        }
        for list in agg.iter_mut() {
            list.sort_by_key(|a| a.0);
            let mut merged: Vec<(u32, f64)> = Vec::with_capacity(list.len());
            for &(j, w) in list.iter() {
                match merged.last_mut() {
                    Some(last) if last.0 == j => last.1 += w,
                    _ => merged.push((j, w)),
                }
            }
            *list = merged;
        }
        adj = agg;
    }
    // Order communities by size, then by smallest member.
    let k = membership
        .iter()
        .copied()
        .max()
        .map(|m| m as usize + 1)
        .unwrap_or(0);
    let mut size = vec![0usize; k];
    let mut first = vec![usize::MAX; k];
    for (i, &c) in membership.iter().enumerate() {
        size[c as usize] += 1;
        first[c as usize] = first[c as usize].min(i);
    }
    let mut order: Vec<usize> = (0..k).collect();
    order.sort_by(|&a, &b| size[b].cmp(&size[a]).then(first[a].cmp(&first[b])));
    let mut rank = vec![0u32; k];
    for (r, &c) in order.iter().enumerate() {
        rank[c] = r as u32;
    }
    membership.iter().map(|&c| rank[c as usize]).collect()
}

/// One pass of local moves. Returns (community per node, whether anything moved).
fn one_level(adj: &[Vec<(u32, f64)>]) -> (Vec<u32>, bool) {
    let n = adj.len();
    let degree: Vec<f64> = adj
        .iter()
        .map(|l| l.iter().map(|&(_, w)| w).sum())
        .collect();
    let m2: f64 = degree.iter().sum();
    let mut comm: Vec<u32> = (0..n as u32).collect();
    if m2 == 0.0 {
        return (comm, false);
    }
    let mut tot: Vec<f64> = degree.clone();
    let mut moved_any = false;
    let mut weights: Vec<f64> = vec![0.0; n];
    let mut touched: Vec<u32> = Vec::new();
    for _pass in 0..32 {
        let mut moved = false;
        for i in 0..n {
            let ci = comm[i];
            let ki = degree[i];
            // Weights from i to each neighbouring community.
            for &c in &touched {
                weights[c as usize] = 0.0;
            }
            touched.clear();
            for &(j, w) in &adj[i] {
                if j as usize == i {
                    continue;
                }
                let cj = comm[j as usize];
                if weights[cj as usize] == 0.0 {
                    touched.push(cj);
                }
                weights[cj as usize] += w;
            }
            tot[ci as usize] -= ki;
            let mut best = ci;
            let mut best_gain = weights[ci as usize] - tot[ci as usize] * ki / m2;
            touched.sort_unstable();
            for &c in &touched {
                let gain = weights[c as usize] - tot[c as usize] * ki / m2;
                if gain > best_gain + 1e-12 || ((gain - best_gain).abs() <= 1e-12 && c < best) {
                    best = c;
                    best_gain = gain;
                }
            }
            tot[best as usize] += ki;
            if best != ci {
                comm[i] = best;
                moved = true;
                moved_any = true;
            }
        }
        if !moved {
            break;
        }
    }
    (comm, moved_any)
}

/// Newman modularity of a partition (for tests and diagnostics).
pub fn modularity(g: &Graph, comm: &[u32]) -> f64 {
    let degree: Vec<f64> = g
        .adj
        .iter()
        .map(|l| l.iter().map(|&(_, w)| w).sum())
        .collect();
    let m2: f64 = degree.iter().sum();
    if m2 == 0.0 {
        return 0.0;
    }
    let k = comm
        .iter()
        .copied()
        .max()
        .map(|m| m as usize + 1)
        .unwrap_or(0);
    let mut inside = vec![0.0; k];
    let mut tot = vec![0.0; k];
    for (i, nbrs) in g.adj.iter().enumerate() {
        tot[comm[i] as usize] += degree[i];
        for &(j, w) in nbrs {
            if comm[j as usize] == comm[i] {
                inside[comm[i] as usize] += w;
            }
        }
    }
    (0..k).map(|c| inside[c] / m2 - (tot[c] / m2).powi(2)).sum()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn two_cliques() -> Graph {
        // Two 4-cliques joined by one edge.
        let mut e = Vec::new();
        for a in 0..4u32 {
            for b in (a + 1)..4 {
                e.push((a, b));
                e.push((a + 4, b + 4));
            }
        }
        e.push((3, 4));
        Graph::new(8, &e)
    }

    #[test]
    fn louvain_splits_two_cliques() {
        let g = two_cliques();
        let c = louvain(&g);
        assert_eq!(&c[0..4], &[c[0]; 4]);
        assert_eq!(&c[4..8], &[c[4]; 4]);
        assert_ne!(c[0], c[4]);
        assert!(modularity(&g, &c) > 0.35);
    }

    #[test]
    fn pagerank_sums_to_one_and_favours_hubs() {
        let g = Graph::new(4, &[(0, 3), (1, 3), (2, 3), (3, 0)]);
        let r = pagerank(&g, 50);
        let s: f64 = r.iter().sum();
        assert!((s - 1.0).abs() < 1e-9);
        assert!(r[3] > r[0] && r[0] > r[1]);
    }

    #[test]
    fn empty_graph() {
        let g = Graph::new(0, &[]);
        assert!(pagerank(&g, 10).is_empty());
        assert!(louvain(&g).is_empty());
    }
}
