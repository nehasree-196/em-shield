"""
optimizer.py - every search algorithm, no physics.

A stack is a list of (material_id, thickness_m) tuples, ordered from the incident side.
The optimizer only calls  se_fn(stack) -> worst-case SE in dB  (see se_evaluator.py).

Ranking rule (feasibility first), lower is better:
    feasible   -> (0, cost)        cost = total thickness (or areal mass)
    infeasible -> (1, violation)   violation = SE shortfall (+ penalties for broken extra rules)
"""
import itertools
import numpy as np
from scipy.stats import qmc


# --------------------------------------------------------------------------- problem

class Problem:
    def __init__(self, se_fn, materials, se_min, limits=None, n_max=3,
                 d_min=1e-5, d_max=2e-3, total_max=None,
                 cost_fn=None, extra_violation=None):
        """limits: {material_id: (min_thickness, max_thickness)}; missing ids get (d_min, d_max).
        extra_violation(stack) -> 0 if OK, >0 if a user rule (must-include, max mass...) is broken."""
        self.se_fn = se_fn
        self.materials = list(materials)
        self.se_min = se_min
        self.n_max = n_max

        limits = limits or {}
        self.limits = {m: tuple(limits.get(m, (d_min, d_max))) for m in self.materials}
        self.span = max(hi - lo for lo, hi in self.limits.values()) or 1e-4
        self.total_max = total_max if total_max is not None else float("inf")
        self.cost_fn = cost_fn or (lambda s: sum(d for _, d in s))
        self.extra_violation = extra_violation or (lambda s: 0.0)

        self.reset()

    def reset(self):
        """Reset evaluation count and cache. Call before each algorithm run."""
        self.evals = 0
        self.cache = {}

    def pick(self, rng):
        return self.materials[int(rng.integers(len(self.materials)))]

    def repair(self, stack):
        """Make any stack valid: merge touching same-material layers, clip thickness to
        each material's limits, cap layer count and total thickness.
        Returns (stack, structurally_ok): structurally_ok is False when the total still
        exceeds total_max even at the per-material minimums (the caller should not
        evaluate such a stack)."""
        lim = self.limits
        merged = []
        for m, d in stack:
            if merged and merged[-1][0] == m:
                merged[-1] = (m, merged[-1][1] + d)
            else:
                merged.append((m, d))

        stack = [(m, min(max(d, lim[m][0]), lim[m][1])) for m, d in merged][: self.n_max]
        if not stack:
            m = self.materials[0]
            stack = [(m, lim[m][0])]

        total = sum(d for _, d in stack)
        ok = True
        if total > self.total_max:
            k = self.total_max / total
            stack = [(m, max(lim[m][0], d * k)) for m, d in stack]
            ok = sum(d for _, d in stack) <= self.total_max + 1e-12

        return [(m, round(d, 7)) for m, d in stack], ok

    def random_stack(self, rng):
        n = int(rng.integers(1, self.n_max + 1))
        out = []
        for _ in range(n):
            m = self.pick(rng)
            out.append((m, rng.uniform(*self.limits[m])))
        return self.repair(out)[0]

    def score(self, stack):
        key = tuple(stack)
        if key not in self.cache:
            self.evals += 1                                   # one real solver call
            se = self.se_fn(stack)
            total = sum(d for _, d in stack)
            viol = max(0.0, self.se_min - se) + self.extra_violation(stack)
            viol += 100.0 * 1e3 * max(0.0, total - self.total_max)   # 1 mm over = 100
            self.cache[key] = ((0, self.cost_fn(stack)) if viol == 0 else (1, viol), se)
        return self.cache[key][0]

    def pool(self, feasible=True):
        """Best stack per distinct material sequence -> [(score_value, stack, se)], best first.
        Used to seed local refinement."""
        best = {}
        for key, (sc, se) in self.cache.items():
            if (sc[0] == 0) != feasible:
                continue
            seq = tuple(m for m, _ in key)
            if seq not in best or sc[1] < best[seq][0]:
                best[seq] = (sc[1], list(key), se)
        return sorted(best.values(), key=lambda x: x[0])

    def pool_stacks(self, feasible=True, top_k=100):
        """Top-K stacks regardless of material sequence -> for the UI display."""
        rows = [(sc[1], list(key), se) for key, (sc, se) in self.cache.items()
                if (sc[0] == 0) == feasible]
        rows.sort(key=lambda x: x[0])
        return rows[:top_k]


class Best:
    """Tracks best-so-far and a convergence history of (evaluations, score)."""
    def __init__(self, p):
        self.p, self.stack, self.score, self.history = p, None, (9, 1e9), []

    def update(self, s):
        sc = self.p.score(s)
        if sc < self.score:
            self.stack, self.score = s, sc
        self.history.append((self.p.evals, self.score))


# --------------------------------------------------------------------------- baselines

def exhaustive(p, thickness_grid):
    """Reference answer for SMALL problems (2-3 materials, n_max<=3, ~5 grid values).
    Deliberately ignores any iteration limit: this is the ground truth."""
    best = Best(p)
    for n in range(1, p.n_max + 1):
        for mats in itertools.product(p.materials, repeat=n):
            for ds in itertools.product(thickness_grid, repeat=n):
                stack, _ = p.repair(list(zip(mats, ds)))
                best.update(stack)
    return best


def random_search(p, seed=0, max_iter=10000):
    rng, best = np.random.default_rng(seed), Best(p)
    for _ in range(max_iter):
        best.update(p.random_stack(rng))
    return best


def lhs_population(p, size, rng):
    """Latin Hypercube thicknesses -> evenly spread initial population."""
    u = qmc.LatinHypercube(d=p.n_max, seed=rng).random(size)
    pop = []
    for row in u:
        n = int(rng.integers(1, p.n_max + 1))
        layers = []
        for x in row[:n]:
            m = p.pick(rng)
            lo, hi = p.limits[m]
            layers.append((m, lo + x * (hi - lo)))
        pop.append(p.repair(layers)[0])
    return pop


# --------------------------------------------------------------------------- genetic algorithm

def mutate(p, s, rng, sigma=0.1):
    s, r = list(s), rng.random()
    i = int(rng.integers(len(s)))
    lo, hi = p.limits[s[i][0]]
    if r < 0.40:                                                   # thickness
        s[i] = (s[i][0], s[i][1] + rng.normal(0, sigma * (hi - lo)))
    elif r < 0.55:                                                 # material
        s[i] = (p.pick(rng), s[i][1])
    elif r < 0.70 and len(s) < p.n_max:                            # add layer
        m = p.pick(rng)
        s.insert(int(rng.integers(len(s) + 1)), (m, rng.uniform(*p.limits[m])))
    elif r < 0.85 and len(s) > 1:                                  # delete layer
        s.pop(i)
    elif len(s) > 1:                                               # swap two layers
        j = int(rng.integers(len(s)))
        s[i], s[j] = s[j], s[i]
    return p.repair(s)[0]


def crossover(p, a, b, rng):
    """Head of parent A + tail of parent B."""
    i, j = int(rng.integers(0, len(a) + 1)), int(rng.integers(0, len(b) + 1))
    return p.repair((a[:i] + b[j:]) or a)[0]


def tournament(pop, scores, rng, k=3):
    idx = rng.integers(0, len(pop), k)
    return pop[min(idx, key=lambda i: scores[i])]


def genetic_algorithm(p, seed=0, pop_size=40, elite=2, p_cross=0.8, p_mut=0.5,
                      immigrants=0.1, max_gen=200):
    rng, best = np.random.default_rng(seed), Best(p)
    pop = lhs_population(p, pop_size, rng)
    n_imm = max(1, int(immigrants * pop_size))
    for _ in range(max_gen):
        scores = [p.score(s) for s in pop]
        for s in pop:
            best.update(s)
        order = sorted(range(len(pop)), key=lambda i: scores[i])
        new = [pop[i] for i in order[:elite]]
        while len(new) < pop_size - n_imm:
            a, b = tournament(pop, scores, rng), tournament(pop, scores, rng)
            child = crossover(p, a, b, rng) if rng.random() < p_cross else a
            if rng.random() < p_mut:
                child = mutate(p, child, rng)
            new.append(child)
        new += [p.random_stack(rng) for _ in range(n_imm)]
        pop = new
    return best


# --------------------------------------------------------------------------- local refinement

def coordinate_descent(p, stack, step=None, min_step=1e-6, max_iter=2000):
    """One layer at a time: thin it, thicken it (if infeasible), or delete it.
    Halve step when stuck."""
    cur, step, it = stack, step or p.span / 4, 0
    while step >= min_step and it < max_iter:
        improved = False
        for i in range(len(cur)):
            if i >= len(cur):
                break
            moves = [list(cur) for _ in range(3)]
            moves[0][i] = (cur[i][0], cur[i][1] - step)
            moves[1][i] = (cur[i][0], cur[i][1] + step)
            moves[2] = list(cur[:i] + cur[i + 1:]) if len(cur) > 1 else None
            for t in moves:
                if t is None:
                    continue
                t, _ = p.repair(t)
                it += 1
                if p.score(t) < p.score(cur):
                    cur, improved = t, True
                    break
                if it >= max_iter:
                    break
        if not improved:
            step /= 2
    return cur


def pattern_search(p, stack, step=None, min_step=1e-6, max_iter=2000):
    """Compass search: poll every direction (each layer +/-, and ALL layers together).
    Halve step when no direction improves."""
    cur, step, it = stack, step or p.span / 4, 0
    while step >= min_step and it < max_iter:
        trials = []
        for i in range(len(cur)):
            for sign in (-1, 1):
                t = list(cur)
                t[i] = (cur[i][0], cur[i][1] + sign * step)
                trials.append(p.repair(t)[0])
        for sign in (-1, 1):
            trials.append(p.repair([(m, d + sign * step) for m, d in cur])[0])
        top = min(trials, key=p.score)
        it += len(trials)
        if p.score(top) < p.score(cur):
            cur = top
        else:
            step /= 2
    return cur


# --------------------------------------------------------------------------- fixed-sequence (thickness only)

def differential_evolution(p, mats, seed=0, pop_size=20, F=0.7, CR=0.8, max_gen=500):
    rng, best, n = np.random.default_rng(seed), Best(p), len(mats)
    lo = np.array([p.limits[m][0] for m in mats])
    hi = np.array([p.limits[m][1] for m in mats])
    make = lambda x: p.repair(list(zip(mats, x)))[0]
    X = rng.uniform(lo, hi, (pop_size, n))
    S = [p.score(make(x)) for x in X]
    for x in X:
        best.update(make(x))
    for _ in range(max_gen):
        for i in range(pop_size):
            a, b, c = X[rng.choice([k for k in range(pop_size) if k != i], 3, replace=False)]
            mutant = np.clip(a + F * (b - c), lo, hi)
            cross = rng.random(n) < CR
            cross[rng.integers(n)] = True
            trial = np.where(cross, mutant, X[i])
            s = p.score(make(trial))
            best.update(make(trial))
            if s <= S[i]:
                X[i], S[i] = trial, s
    return best


def pso(p, mats, seed=0, swarm=20, w=0.7, c1=1.5, c2=1.5, max_iter=500):
    rng, best, n = np.random.default_rng(seed), Best(p), len(mats)
    lo = np.array([p.limits[m][0] for m in mats])
    hi = np.array([p.limits[m][1] for m in mats])
    make = lambda x: p.repair(list(zip(mats, x)))[0]
    X = rng.uniform(lo, hi, (swarm, n))
    V = np.zeros((swarm, n))
    P, PS = X.copy(), [p.score(make(x)) for x in X]
    g = min(range(swarm), key=lambda i: PS[i])
    G, GS = P[g].copy(), PS[g]
    for _ in range(max_iter):
        r1, r2 = rng.random((2, swarm, n))
        V = w * V + c1 * r1 * (P - X) + c2 * r2 * (G - X)
        X = np.clip(X + V, lo, hi)
        for i in range(swarm):
            s = p.score(make(X[i]))
            best.update(make(X[i]))
            if s < PS[i]:
                P[i], PS[i] = X[i].copy(), s
            if s < GS:
                G, GS = X[i].copy(), s
    return best


# --------------------------------------------------------------------------- drivers

def hybrid(p, seed=0, max_gen=200):
    """GA -> coordinate descent -> pattern search."""
    best = genetic_algorithm(p, seed, max_gen=max_gen)
    s = coordinate_descent(p, best.stack)
    best.update(s)
    best.update(pattern_search(p, s))
    return best


def find_candidates(p, seed=0, restarts=3, max_gen=200, refine_top=20):
    """Fill p.cache with many DISTINCT good stacks.
    1) several GA runs (different seeds -> different material sequences),
    2) every promising sequence is thinned by coordinate descent + pattern search.
    Read the result with p.pool(...) or p.pool_stacks(...)."""
    for r in range(restarts):
        genetic_algorithm(p, seed + r, max_gen=max_gen)

    seeds = p.pool(True)[:refine_top] or p.pool(False)[:5]
    for _, stack, _ in seeds:
        pattern_search(p, coordinate_descent(p, stack))


# --------------------------------------------------------------------------- validation + comparison

def validate(stack, dense_se_fn, se_min):
    """Re-check a design on a much denser f/theta grid (pass a dense se_fn)."""
    se = dense_se_fn(stack)
    return se, se >= se_min


def compare(p, algos, runs=20):
    """algos = {"name": fn(p, seed) -> Best}. Same settings, many seeds.
    Returns {name: {"feasible_rate": ..., "thicknesses_mm": [...], "histories": [[...], ...]}}."""
    print(f"{'algorithm':<14}{'feasible%':>10}{'best mm':>10}{'median mm':>11}{'std mm':>9}")
    out = {}
    for name, fn in algos.items():
        th, histories = [], []
        for seed in range(runs):
            p.reset()
            b = fn(p, seed)
            histories.append(b.history)
            if b.score[0] == 0:
                th.append(b.score[1] * 1e3)
        rate = 100 * len(th) / runs
        out[name] = {"feasible_rate": rate, "thicknesses_mm": th, "histories": histories}
        if th:
            print(f"{name:<14}{rate:>10.0f}{min(th):>10.3f}{np.median(th):>11.3f}{np.std(th):>9.3f}")
        else:
            print(f"{name:<14}{rate:>10.0f}{'-':>10}{'-':>11}{'-':>9}")
    return out