//! `clio-query` blocks: a small filter language evaluated at build time.
//!
//! ```text
//! [WHERE] type = concept AND (tag = rust OR tag = go) AND NOT status = archived
//! SORT updated DESC  LIMIT 20  SHOW table  FIELDS type, updated, tags
//! ```
//!
//! Fields: `id title type tag status lang path folder updated created
//! reviewed words in out` and any frontmatter key. Operators: `= != ~ !~ > <
//! >= <=` (`~` is case-insensitive substring). `tag = a` also matches `a/b`.

#[derive(Debug, Clone, PartialEq)]
pub enum Expr {
    Cond {
        field: String,
        op: Op,
        value: String,
    },
    And(Box<Expr>, Box<Expr>),
    Or(Box<Expr>, Box<Expr>),
    Not(Box<Expr>),
    All,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Op {
    Eq,
    Ne,
    Contains,
    NotContains,
    Gt,
    Lt,
    Ge,
    Le,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Query {
    pub filter: Expr,
    pub sort: Vec<(String, bool)>,
    pub limit: Option<usize>,
    pub show: String,
    pub fields: Vec<String>,
}

/// Values of one field of one note (several for tags).
pub trait Row {
    fn values(&self, field: &str) -> Vec<String>;
}

#[derive(Debug, Clone, PartialEq)]
enum Tok {
    Word(String),
    Str(String),
    Op(Op),
    Open,
    Close,
    Comma,
}

fn lex(src: &str) -> Result<Vec<Tok>, String> {
    let mut out = Vec::new();
    let chars: Vec<char> = src.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if c.is_whitespace() {
            i += 1;
            continue;
        }
        match c {
            '(' => out.push(Tok::Open),
            ')' => out.push(Tok::Close),
            ',' => out.push(Tok::Comma),
            '"' | '\'' => {
                let q = c;
                let mut s = String::new();
                i += 1;
                while i < chars.len() && chars[i] != q {
                    s.push(chars[i]);
                    i += 1;
                }
                if i >= chars.len() {
                    return Err("unclosed quote".into());
                }
                out.push(Tok::Str(s));
            }
            '=' => out.push(Tok::Op(Op::Eq)),
            '~' => out.push(Tok::Op(Op::Contains)),
            '!' if chars.get(i + 1) == Some(&'=') => {
                out.push(Tok::Op(Op::Ne));
                i += 1;
            }
            '!' if chars.get(i + 1) == Some(&'~') => {
                out.push(Tok::Op(Op::NotContains));
                i += 1;
            }
            '>' | '<' => {
                let eq = chars.get(i + 1) == Some(&'=');
                out.push(Tok::Op(match (c, eq) {
                    ('>', true) => Op::Ge,
                    ('>', false) => Op::Gt,
                    ('<', true) => Op::Le,
                    _ => Op::Lt,
                }));
                if eq {
                    i += 1;
                }
            }
            _ => {
                let mut s = String::new();
                while i < chars.len()
                    && !chars[i].is_whitespace()
                    && !"()=,~!<>\"'".contains(chars[i])
                {
                    s.push(chars[i]);
                    i += 1;
                }
                if s.is_empty() {
                    return Err(format!("unexpected character `{c}`"));
                }
                out.push(Tok::Word(s));
                continue;
            }
        }
        i += 1;
    }
    Ok(out)
}

struct Parser {
    toks: Vec<Tok>,
    pos: usize,
}

const KEYWORDS: &[&str] = &[
    "where", "and", "or", "not", "sort", "limit", "show", "fields", "asc", "desc",
];

impl Parser {
    fn peek_kw(&self, kw: &str) -> bool {
        matches!(self.toks.get(self.pos), Some(Tok::Word(w)) if w.eq_ignore_ascii_case(kw))
    }
    fn eat_kw(&mut self, kw: &str) -> bool {
        if self.peek_kw(kw) {
            self.pos += 1;
            true
        } else {
            false
        }
    }
    fn at_clause_end(&self) -> bool {
        self.pos >= self.toks.len()
            || ["sort", "limit", "show", "fields"]
                .iter()
                .any(|k| self.peek_kw(k))
    }
    fn expr(&mut self) -> Result<Expr, String> {
        let mut left = self.term()?;
        while self.eat_kw("or") {
            let right = self.term()?;
            left = Expr::Or(Box::new(left), Box::new(right));
        }
        Ok(left)
    }
    fn term(&mut self) -> Result<Expr, String> {
        let mut left = self.factor()?;
        while self.eat_kw("and") {
            let right = self.factor()?;
            left = Expr::And(Box::new(left), Box::new(right));
        }
        Ok(left)
    }
    fn factor(&mut self) -> Result<Expr, String> {
        if self.eat_kw("not") {
            return Ok(Expr::Not(Box::new(self.factor()?)));
        }
        if self.toks.get(self.pos) == Some(&Tok::Open) {
            self.pos += 1;
            let e = self.expr()?;
            if self.toks.get(self.pos) != Some(&Tok::Close) {
                return Err("missing `)`".into());
            }
            self.pos += 1;
            return Ok(e);
        }
        let field = match self.toks.get(self.pos) {
            Some(Tok::Word(w)) if !KEYWORDS.contains(&w.to_lowercase().as_str()) => {
                w.to_lowercase()
            }
            other => return Err(format!("expected a field name, found {}", describe(other))),
        };
        self.pos += 1;
        let op = match self.toks.get(self.pos) {
            Some(Tok::Op(op)) => *op,
            other => {
                return Err(format!(
                    "expected an operator after `{field}`, found {}",
                    describe(other)
                ))
            }
        };
        self.pos += 1;
        let value = match self.toks.get(self.pos) {
            Some(Tok::Word(w)) | Some(Tok::Str(w)) => w.clone(),
            other => {
                return Err(format!(
                    "expected a value after `{field}`, found {}",
                    describe(other)
                ))
            }
        };
        self.pos += 1;
        Ok(Expr::Cond { field, op, value })
    }
}

fn describe(t: Option<&Tok>) -> String {
    match t {
        None => "end of query".into(),
        Some(Tok::Word(w)) | Some(Tok::Str(w)) => format!("`{w}`"),
        Some(Tok::Op(_)) => "an operator".into(),
        Some(Tok::Open) => "`(`".into(),
        Some(Tok::Close) => "`)`".into(),
        Some(Tok::Comma) => "`,`".into(),
    }
}

pub fn parse(src: &str) -> Result<Query, String> {
    let toks = lex(src)?;
    let mut p = Parser { toks, pos: 0 };
    p.eat_kw("where");
    let filter = if p.at_clause_end() {
        Expr::All
    } else {
        p.expr()?
    };
    let mut q = Query {
        filter,
        sort: Vec::new(),
        limit: None,
        show: "list".into(),
        fields: Vec::new(),
    };
    while p.pos < p.toks.len() {
        if p.eat_kw("sort") {
            loop {
                let field = match p.toks.get(p.pos) {
                    Some(Tok::Word(w)) => w.to_lowercase(),
                    other => {
                        return Err(format!(
                            "expected a field after SORT, found {}",
                            describe(other)
                        ))
                    }
                };
                p.pos += 1;
                let desc = if p.eat_kw("desc") {
                    true
                } else {
                    p.eat_kw("asc");
                    false
                };
                q.sort.push((field, desc));
                if p.toks.get(p.pos) == Some(&Tok::Comma) {
                    p.pos += 1;
                } else {
                    break;
                }
            }
        } else if p.eat_kw("limit") {
            match p.toks.get(p.pos) {
                Some(Tok::Word(w)) => {
                    q.limit = Some(
                        w.parse()
                            .map_err(|_| format!("LIMIT needs a number, got `{w}`"))?,
                    )
                }
                other => {
                    return Err(format!(
                        "expected a number after LIMIT, found {}",
                        describe(other)
                    ))
                }
            }
            p.pos += 1;
        } else if p.eat_kw("show") {
            match p.toks.get(p.pos) {
                Some(Tok::Word(w))
                    if ["list", "table", "cards"].contains(&w.to_lowercase().as_str()) =>
                {
                    q.show = w.to_lowercase()
                }
                other => {
                    return Err(format!(
                        "SHOW takes list, table or cards, found {}",
                        describe(other)
                    ))
                }
            }
            p.pos += 1;
        } else if p.eat_kw("fields") {
            loop {
                match p.toks.get(p.pos) {
                    Some(Tok::Word(w)) => q.fields.push(w.to_lowercase()),
                    other => {
                        return Err(format!(
                            "expected a field after FIELDS, found {}",
                            describe(other)
                        ))
                    }
                }
                p.pos += 1;
                if p.toks.get(p.pos) == Some(&Tok::Comma) {
                    p.pos += 1;
                } else {
                    break;
                }
            }
        } else {
            return Err(format!("unexpected {}", describe(p.toks.get(p.pos))));
        }
    }
    Ok(q)
}

fn num(s: &str) -> Option<f64> {
    s.trim().parse::<f64>().ok()
}

fn compare(a: &str, b: &str) -> std::cmp::Ordering {
    match (num(a), num(b)) {
        (Some(x), Some(y)) => x.partial_cmp(&y).unwrap_or(std::cmp::Ordering::Equal),
        _ => a.to_lowercase().cmp(&b.to_lowercase()),
    }
}

pub fn matches(e: &Expr, row: &dyn Row) -> bool {
    match e {
        Expr::All => true,
        Expr::And(a, b) => matches(a, row) && matches(b, row),
        Expr::Or(a, b) => matches(a, row) || matches(b, row),
        Expr::Not(a) => !matches(a, row),
        Expr::Cond { field, op, value } => {
            let vals = row.values(field);
            let v = value.to_lowercase();
            let is_tag = field == "tag" || field == "tags";
            let eq = |x: &String| {
                let x = x.to_lowercase();
                x == v || (is_tag && x.starts_with(&format!("{v}/")))
            };
            match op {
                Op::Eq => vals.iter().any(eq),
                Op::Ne => !vals.iter().any(eq),
                Op::Contains => vals.iter().any(|x| x.to_lowercase().contains(&v)),
                Op::NotContains => !vals.iter().any(|x| x.to_lowercase().contains(&v)),
                Op::Gt => vals.iter().any(|x| compare(x, value).is_gt()),
                Op::Lt => vals.iter().any(|x| compare(x, value).is_lt()),
                Op::Ge => vals.iter().any(|x| !compare(x, value).is_lt()),
                Op::Le => vals.iter().any(|x| !compare(x, value).is_gt()),
            }
        }
    }
}

/// Filter, sort and limit `rows` (given with a stable tie-break order).
pub fn run<'r, R: Row>(q: &Query, rows: &'r [R]) -> Vec<&'r R> {
    let mut hits: Vec<&R> = rows.iter().filter(|r| matches(&q.filter, *r)).collect();
    if !q.sort.is_empty() {
        hits.sort_by(|a, b| {
            for (field, desc) in &q.sort {
                let x = a.values(field).into_iter().next().unwrap_or_default();
                let y = b.values(field).into_iter().next().unwrap_or_default();
                let o = compare(&x, &y);
                let o = if *desc { o.reverse() } else { o };
                if o.is_ne() {
                    return o;
                }
            }
            std::cmp::Ordering::Equal
        });
    }
    if let Some(n) = q.limit {
        hits.truncate(n);
    }
    hits
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    struct R(BTreeMap<&'static str, Vec<&'static str>>);
    impl Row for R {
        fn values(&self, f: &str) -> Vec<String> {
            self.0
                .get(f)
                .map(|v| v.iter().map(|s| s.to_string()).collect())
                .unwrap_or_default()
        }
    }
    fn row(pairs: &[(&'static str, &[&'static str])]) -> R {
        R(pairs.iter().map(|(k, v)| (*k, v.to_vec())).collect())
    }

    #[test]
    fn parses_full_query() {
        let q = parse("where type = concept and (tag = rust or tag = \"go lang\") and not status = archived sort updated desc, title limit 5 show table fields type, updated").unwrap();
        assert_eq!(
            q.sort,
            vec![("updated".into(), true), ("title".into(), false)]
        );
        assert_eq!(q.limit, Some(5));
        assert_eq!(q.show, "table");
        assert_eq!(q.fields, vec!["type", "updated"]);
    }

    #[test]
    fn evaluates_and_sorts() {
        let rows = vec![
            row(&[
                ("title", &["b"]),
                ("type", &["concept"]),
                ("tag", &["rust/async"]),
                ("updated", &["2026-01-02"]),
            ]),
            row(&[
                ("title", &["a"]),
                ("type", &["concept"]),
                ("tag", &["go"]),
                ("updated", &["2026-03-01"]),
            ]),
            row(&[
                ("title", &["c"]),
                ("type", &["entity"]),
                ("tag", &["rust"]),
                ("updated", &["2025-01-01"]),
            ]),
        ];
        let q = parse("type = concept AND tag = rust").unwrap();
        assert_eq!(run(&q, &rows).len(), 1);
        let q = parse("SORT updated DESC LIMIT 2").unwrap();
        let titles: Vec<_> = run(&q, &rows)
            .iter()
            .map(|r| r.values("title")[0].clone())
            .collect();
        assert_eq!(titles, vec!["a", "b"]);
        let q = parse("words > 10").unwrap();
        assert!(run(&q, &rows).is_empty());
    }

    #[test]
    fn reports_errors() {
        assert!(parse("type =").is_err());
        assert!(parse("(type = a").is_err());
        assert!(parse("limit x").is_err());
        assert!(parse("\"open").is_err());
    }
}
