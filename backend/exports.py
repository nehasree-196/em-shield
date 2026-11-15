"""exports.py — server-side PDF report generation (matplotlib charts + reportlab layout).

The report mirrors the ETAP load-flow style: a cover block with the run's
parameters and key results, then the parameter tables, the charts, the failing
ranges, and a data appendix. Every number in the PDF is recomputed by the
route from the request payload — the client sends inputs, never results.
"""
from __future__ import annotations

import io
from datetime import datetime, timezone

import matplotlib
matplotlib.use("Agg")  # headless: no display needed on the server
import matplotlib.pyplot as plt
from matplotlib.ticker import LogLocator, NullFormatter

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

# ---------------------------------------------------------------------------
# Palette — exactly the frontend app palette
# ---------------------------------------------------------------------------
ACCENT   = colors.HexColor("#5b3df5")
ABSORB   = colors.HexColor("#1f9d8a")
MULTI    = colors.HexColor("#d98e04")
TOTAL    = colors.HexColor("#e0457b")
FAIL     = colors.HexColor("#dc2626")
MUTED    = colors.HexColor("#77749d")
DEEP     = colors.HexColor("#321d70")
BORDER   = colors.HexColor("#c0caff")
PANEL    = colors.HexColor("#edf0ff")

# Hex strings for matplotlib (same order as ResultsChart.jsx COLORS)
MPL = ["#5b3df5", "#e0457b", "#1f9d8a", "#d98e04"]

TEAM = "EM-Shield Project Team  ·  2401EE13 · 2402PC02 · 2401EE15 · 2401EE27 · 2401EE12"


# ---------------------------------------------------------------------------
# Header / footer drawn on every page
# ---------------------------------------------------------------------------
def _decorate(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(ACCENT)
    canvas.rect(0, h - 8 * mm, w, 4 * mm, stroke=0, fill=1)
    seg = w / 4.0
    for i, c in enumerate((ACCENT, ABSORB, MULTI, TOTAL)):
        canvas.setFillColor(c)
        canvas.rect(i * seg, 0, seg, 2 * mm, stroke=0, fill=1)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(15 * mm, 6 * mm, TEAM)
    canvas.drawRightString(w - 15 * mm, 6 * mm, f"Page {doc.page}")
    canvas.restoreState()


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------
def _styles():
    ss = getSampleStyleSheet()
    ss.add(ParagraphStyle(
        "CoverTitle", parent=ss["Title"], fontName="Helvetica-Bold",
        fontSize=22, textColor=colors.HexColor("#1a1140"),
        spaceAfter=4, alignment=0, backColor=None, borderWidth=0,
    ))
    ss.add(ParagraphStyle(
        "CoverSub", parent=ss["Normal"], fontSize=10, textColor=MUTED, spaceAfter=14,
    ))
    ss.add(ParagraphStyle(
        "H2", parent=ss["Heading2"], fontName="Helvetica-Bold",
        fontSize=13, textColor=DEEP, spaceBefore=14, spaceAfter=6,
    ))
    ss.add(ParagraphStyle(
        "Body2", parent=ss["Normal"], fontSize=9, leading=13, textColor=colors.black,
    ))
    ss.add(ParagraphStyle(
        "Caption", parent=ss["Normal"], fontSize=8, textColor=MUTED, spaceAfter=10,
    ))
    return ss


def _kv_table(rows, col_widths=(55 * mm, 110 * mm)):
    styles = _styles()
    t = Table(
        [[Paragraph(f"<b>{k}</b>", styles["Body2"]),
          Paragraph(str(v), styles["Body2"])] for k, v in rows],
        colWidths=col_widths,
    )
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), PANEL),
        ("BOX",        (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID",  (0, 0), (-1, -1), 0.25, BORDER),
        ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING",  (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING",   (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
    ]))
    return t


def _grid_table(header, rows, col_widths):
    styles = _styles()
    data = [[Paragraph(f"<b>{h}</b>", styles["Body2"]) for h in header]]
    data += [[Paragraph(str(c), styles["Body2"]) for c in r] for r in rows]
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PANEL),
        ("BOX",        (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID",  (0, 0), (-1, -1), 0.25, BORDER),
        ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING",  (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING",   (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
    ]))
    return t


def _fig_image(fig, width_mm=170):
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=170, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    buf.seek(0)
    from PIL import Image as PILImage
    w_px, h_px = PILImage.open(buf).size
    buf.seek(0)
    w_mm = width_mm
    h_mm = w_mm * h_px / w_px
    return Image(buf, width=w_mm * mm, height=h_mm * mm)


def _style_axes(ax, title, xlabel, ylabel, logx=False):
    ax.set_title(title, fontsize=10, color="#321d70", pad=8)
    ax.set_xlabel(xlabel, fontsize=8, color="#292052")
    ax.set_ylabel(ylabel, fontsize=8, color="#292052")
    ax.tick_params(axis="both", labelsize=7, colors="#77749d")
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    for s in ("left", "bottom"):
        ax.spines[s].set_color("#c0caff")
    ax.grid(True, which="major", color="#e2e7ff", linewidth=0.6)
    if logx:
        ax.set_xscale("log")
        ax.xaxis.set_major_locator(LogLocator(base=10))
        ax.xaxis.set_minor_formatter(NullFormatter())


def _fmt_freq(hz):
    if hz is None:
        return "n/a"
    if hz >= 1e9:  return f"{hz / 1e9:.4g} GHz"
    if hz >= 1e6:  return f"{hz / 1e6:.4g} MHz"
    if hz >= 1e3:  return f"{hz / 1e3:.4g} kHz"
    return f"{hz:.4g} Hz"


def _fmt_len(x):
    if x is None:
        return "n/a"
    if abs(x) >= 1e-3:  return f"{x * 1e3:.3f} mm"
    if abs(x) >= 1e-6:  return f"{x * 1e6:.3f} µm"
    if abs(x) >= 1e-9:  return f"{x * 1e9:.3f} nm"
    return f"{x:.3e} m"


def _se_chart(f, se, target, fail_ranges):
    fig, ax = plt.subplots(figsize=(7.2, 3.0))
    for r in fail_ranges:
        ax.axvspan(r["start_hz"], r["end_hz"], color="#dc2626", alpha=0.10, linewidth=0)
    ax.plot(f, se, color=MPL[0], linewidth=2, label="SE total")
    ax.axhline(target, color="#dc2626", linestyle="--", linewidth=1.2,
               label=f"Target {target:g} dB")
    _style_axes(ax, "Shielding effectiveness vs frequency", "Frequency (Hz)", "SE (dB)", logx=True)
    ax.legend(fontsize=7, frameon=False, loc="best")
    return fig


def _power_chart(f, R, T, A):
    fig, ax = plt.subplots(figsize=(7.2, 3.0))
    ax.plot(f, R, color=MPL[0], linewidth=1.8, label="R (reflection)")
    ax.plot(f, T, color=MPL[1], linewidth=1.8, label="T (transmission)")
    ax.plot(f, A, color=MPL[2], linewidth=1.8, label="A (absorption)")
    _style_axes(ax, "Reflection, transmission and absorption", "Frequency (Hz)",
                "Power fraction (0–1)", logx=True)
    ax.set_ylim(-0.02, 1.02)
    ax.legend(fontsize=7, frameon=False, loc="best")
    return fig


def _sensitivity_chart(f, nominal, lo, hi, label):
    fig, ax = plt.subplots(figsize=(7.2, 3.0))
    ax.plot(f, lo,      color=MPL[3], linewidth=1.4, linestyle="--", label="−10%")
    ax.plot(f, nominal, color=MPL[0], linewidth=2.0, label="Nominal")
    ax.plot(f, hi,      color=MPL[2], linewidth=1.4, linestyle="--", label="+10%")
    _style_axes(ax, f"SE sensitivity — {label} ±10%", "Frequency (Hz)", "SE (dB)", logx=True)
    ax.legend(fontsize=7, frameon=False, loc="best")
    return fig


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
def export_report_pdf(*,
                      label: str = "EM-Shield report",
                      single: dict | None = None,
                      stack: dict | None = None,
                      analysis: dict | None = None,
                      sweep: dict | None = None,
                      sweep_sensitivity: dict | None = None,
                      sweep_request: dict | None = None,
                      sweep_f_start_hz: float | None = None,
                      sweep_f_end_hz: float | None = None,
                      sweep_target_db: float | None = None,
                      max_table_rows: int = 200) -> bytes:
    """Single PDF containing whichever sections are provided."""
    ss = _styles()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=18 * mm, bottomMargin=15 * mm,
        title=label, author="EM-Shield", subject=label,
    )
    story = []

    # ---- Cover ----
    story.append(Paragraph("EM-Shield · Shielding Report", ss["CoverTitle"]))
    story.append(Paragraph(
        f"Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}  ·  {label}",
        ss["CoverSub"],
    ))
    included = []
    if single is not None:  included.append("Single-layer result")
    if stack is not None:   included.append("Multilayer result (fixed frequency)")
    if analysis is not None: included.append("Multilayer band analysis")
    if sweep is not None:   included.append("Frequency sweep")
    if included:
        story.append(Paragraph("Included sections: " + " · ".join(included), ss["Body2"]))
        story.append(Spacer(1, 8))

    # Only page-break between sections, not before the first one.
    _section_started = {"v": False}
    def _section(title):
        if _section_started["v"]:
            story.append(PageBreak())
        story.append(Paragraph(title, ss["H2"]))
        _section_started["v"] = True

    # =========================================================
    # 1. SINGLE LAYER — full numbers, key-value block, profile chart, profile table
    # =========================================================
    if single is not None:
        _section("1. Single-layer result")

        # --- Key numbers (mirrors the "Key numbers" panel on Page 3) ---
        story.append(Paragraph("Key numbers", ss["H2"]))
        rows = [
            ("Material",                    single["material"]),
            ("Thickness",                   f"{single['thickness_m'] * 1e3:.3f} mm"),
            ("Frequency",                   _fmt_freq(single["frequency_hz"])),
            ("Shielding effectiveness, SE", f"{single['shielding_effectiveness_db']:.2f} dB"),
            ("Reflection power, R",         f"{single['reflection_power']:.5f}"),
            ("Transmission power, T",       f"{single['transmission_power']:.3e}"),
            ("Absorption power, A",         f"{single['absorption_power']:.5f}"),
            ("Skin depth, δ = √(2/ωμσ)",    _fmt_len(single["skin_depth_m"])),
            ("Skin depth (good-conductor)",
             _fmt_len(single["skin_depth_good_conductor_m"])),
            ("Thickness in skin depths, t/δ",
             f"{single['thickness_over_skin_depth']:.3f}"
             if single["thickness_over_skin_depth"] is not None else "n/a"),
            ("Conduction ratio, σ/(ωε)",
             f"{single['conductor_ratio']:.3e}"
             if single["conductor_ratio"] is not None else "n/a"),
        ]
        story.append(_kv_table(rows))
        story.append(Spacer(1, 8))

        # --- Model assumptions (mirrors the "Wave assumptions" / "Model notes" lists on Page 3) ---
        story.append(Paragraph("Model assumptions", ss["H2"]))
        notes = [
            "Normally incident, far-field plane wave.",
            "Uniform, infinite planar slab in air.",
            "Constant material properties.",
            "No apertures, seams or edges.",
            "The attenuation profile is a single-pass envelope and ignores "
            "internal reflections.",
        ]
        for n in notes:
            story.append(Paragraph(f"• {n}", ss["Body2"]))
        story.append(Spacer(1, 6))

        # --- Field attenuation profile chart ---
        story.append(Paragraph("Field attenuation through the slab (single pass)",
                               ss["H2"]))
        fig, ax = plt.subplots(figsize=(7.2, 3.0))
        z_um = [z * 1e6 for z in single["profile_z_m"]]
        ax.plot(z_um, single["profile_relative_amplitude"],
                color=MPL[0], linewidth=2)
        _style_axes(ax, "|E(z)| / |E(0)|", "Depth into slab, z (µm)",
                    "Relative field amplitude")
        ax.set_ylim(-0.02, 1.02)
        story.append(_fig_image(fig))
        story.append(Paragraph(
            "Single-pass envelope exp(−αz). Internal reflections not included.",
            ss["Caption"],
        ))

        # --- Profile data table (every ~10th point so it fits on one page) ---
        z = single["profile_z_m"]
        amp = single["profile_relative_amplitude"]
        step = max(1, len(z) // 10)
        idx = list(range(0, len(z), step))
        if idx[-1] != len(z) - 1:
            idx.append(len(z) - 1)
        profile_rows = [(
            f"{z[i] * 1e6:.4g}",
            f"{amp[i]:.5f}",
        ) for i in idx]
        story.append(Paragraph("Field profile (every ~10th point)", ss["H2"]))
        story.append(_grid_table(
            ["z (µm)", "|E(z)| / |E(0)|"],
            profile_rows,
            col_widths=(55 * mm, 55 * mm),
        ))

    # =========================================================
    # 2. MULTILAYER FIXED-FREQUENCY RESULT — numbers + layer breakdown table
    # =========================================================
    if stack is not None:
        _section("2. Multilayer result (fixed frequency)")

        story.append(Paragraph("Overall performance", ss["H2"]))
        rows = [
            ("Layer count",                  str(stack["layer_count"])),
            ("Total thickness",              f"{stack['total_thickness_m'] * 1e3:.3f} mm"),
            ("Evaluation frequency",         _fmt_freq(stack["frequency_hz"])),
            ("Shielding effectiveness, SE",  f"{stack['shielding_effectiveness_db']:.2f} dB"),
            ("Reflection power, R",          f"{stack['reflection_power']:.5f}"),
            ("Transmission power, T",        f"{stack['transmission_power']:.3e}"),
            ("Absorption power, A",          f"{stack['absorption_power']:.5f}"),
        ]
        story.append(_kv_table(rows))
        story.append(Spacer(1, 8))

        story.append(Paragraph("Stack summary", ss["H2"]))
        layer_rows = [(
            str(s["order"]),
            s["material"],
            f"{s['thickness_m'] * 1e3:.3f} mm",
            _fmt_len(s["skin_depth_m"]),
        ) for s in stack["stack"]]
        story.append(_grid_table(
            ["Layer", "Material", "Thickness", "Skin depth"],
            layer_rows,
            col_widths=(18 * mm, 60 * mm, 42 * mm, 42 * mm),
        ))

    # =========================================================
    # 3. MULTILAYER BAND ANALYSIS
    # =========================================================
    if analysis is not None:
        _section("3. Multilayer band analysis")
        a = analysis
        sm = a["summary"]
        target = a["target_se_db"]
        lf = sm["longest_failing_range_hz"]
        rows = [
            ("Target shielding", f"{target:g} dB"),
            ("Worst-case SE",
             f"{sm['worst_se_db']:.2f} dB @ {_fmt_freq(sm['worst_frequency_hz'])}"),
            ("Margin vs target",
             f"{'+' if sm['margin_db'] >= 0 else '−'}{abs(sm['margin_db']):.2f} dB"),
            ("Band pass rate",   f"{sm['pass_rate_percent']:.1f}%"),
            ("Failing ranges",   str(len(sm["failing_ranges_hz"]))),
            ("Longest failing range",
             "—" if lf is None else
             f"{_fmt_freq(lf['start_hz'])} – {_fmt_freq(lf['end_hz'])}"),
        ]
        story.append(_kv_table(rows))
        story.append(Spacer(1, 8))

        f = a["frequency_hz"]
        fig, ax = plt.subplots(figsize=(7.2, 3.0))
        ax.plot(f, a["se_reflection_db"], color=MPL[0], linewidth=1.6, label="Reflection (R)")
        ax.plot(f, a["se_absorption_db"], color=MPL[2], linewidth=1.6, label="Absorption (A)")
        ax.plot(f, a["se_multi_reflection_db"], color=MPL[3], linewidth=1.2,
                linestyle=":", label="Multi-reflection (B)")
        ax.plot(f, a["se_total_db"], color=MPL[1], linewidth=2.2, label="Total (R+A+B)")
        ax.axhline(target, color="#dc2626", linestyle="--", linewidth=1.2,
                   label=f"Target {target:g} dB")
        _style_axes(ax, "SE breakdown: reflection, absorption, total",
                    "Frequency (Hz)", "SE (dB)", logx=True)
        ax.legend(fontsize=7, frameon=False, loc="best")
        story.append(_fig_image(fig))
        story.append(Paragraph(
            "Schelkunoff split of the total shielding effectiveness.", ss["Caption"],
        ))

        c = a["layer_contribution"]
        story.append(Paragraph(
            f"Layer contribution at {_fmt_freq(c['frequency_hz'])} "
            f"(total {c['total_se_db']:.1f} dB)",
            ss["H2"],
        ))
        fig2, ax2 = plt.subplots(figsize=(7.2, 2.6))
        names = [f"L{l['order']} {l['material']}" for l in c["layers"]]
        values = [l["absorption_db"] for l in c["layers"]]
        colors_ = [MPL[i % len(MPL)] for i in range(len(names))]
        names.append("Reflection & interfaces (R + B)")
        values.append(c["reflection_and_interface_db"])
        colors_.append("#9aa3d6")
        ax2.barh(names, values, color=colors_)
        _style_axes(ax2, "Where the shielding comes from",
                    "Contribution to SE (dB)", "")
        story.append(_fig_image(fig2))

        # Numeric companion to the layer-contribution chart
        contrib_rows = [
            (f"L{l['order']} {l['material']}", f"{l['absorption_db']:.2f}")
            for l in c["layers"]
        ]
        contrib_rows.append(
            ("Reflection & interfaces (R + B)",
             f"{c['reflection_and_interface_db']:.2f}")
        )
        contrib_rows.append(("Total", f"{c['total_se_db']:.2f}"))
        story.append(Paragraph("Layer contribution (dB)", ss["H2"]))
        story.append(_grid_table(
            ["Source", "Contribution (dB)"],
            contrib_rows,
            col_widths=(110 * mm, 55 * mm),
        ))

        sens = a.get("sensitivity")
        if sens and sens.get("rows"):
            story.append(Paragraph(
                f"Tolerance sensitivity (±{int(sens['delta_fraction'] * 100)}%) — "
                f"nominal worst-case SE {sens['nominal_worst_se_db']:.1f} dB",
                ss["H2"],
            ))
            labels = [r["label"] for r in sens["rows"]]
            lo = [r["delta_minus_db"] for r in sens["rows"]]
            hi = [r["delta_plus_db"] for r in sens["rows"]]
            import numpy as _np
            y = _np.arange(len(labels))
            fig3, ax3 = plt.subplots(figsize=(7.2, max(2.4, 0.36 * len(labels) + 1.0)))
            ax3.barh(y - 0.2, lo, height=0.4, color=MPL[1], label="−10%")
            ax3.barh(y + 0.2, hi, height=0.4, color=MPL[2], label="+10%")
            ax3.set_yticks(y)
            ax3.set_yticklabels(labels, fontsize=7)
            ax3.axvline(0, color="#444", linewidth=0.8)
            _style_axes(ax3, "Change in worst-case SE vs nominal (dB)", "Δ SE (dB)", "")
            ax3.legend(fontsize=7, frameon=False, loc="lower right")
            story.append(_fig_image(fig3))

            # Numeric companion to the sensitivity chart
            story.append(Paragraph("Tolerance sensitivity (dB)", ss["H2"]))
            sens_rows = [(
                r["label"],
                f"{r['worst_se_minus_db']:.2f}",
                f"{r['delta_minus_db']:+.2f}",
                f"{r['worst_se_plus_db']:.2f}",
                f"{r['delta_plus_db']:+.2f}",
            ) for r in sens["rows"]]
            story.append(_grid_table(
                ["Layer — parameter",
                 "Worst SE (−10%)", "Δ (−10%)",
                 "Worst SE (+10%)", "Δ (+10%)"],
                sens_rows,
                col_widths=(50 * mm, 25 * mm, 20 * mm, 25 * mm, 20 * mm),
            ))

    # =========================================================
    # 4. FREQUENCY SWEEP
    # =========================================================
    if sweep is not None:
        _section("4. Frequency sweep")
        f = sweep["frequency_hz"]
        se = sweep["shielding_effectiveness_db"]
        R = sweep["reflection_power"]
        T = sweep["transmission_power"]
        A = sweep["absorption_power"]
        fail = sweep.get("failing_ranges_hz") or []
        target = sweep.get("target_se_db") or 0.0

        worst_i = min(range(len(se)), key=lambda i: se[i])
        worst_se = se[worst_i]
        worst_f = f[worst_i]
        margin = worst_se - target
        pass_n = sum(1 for v in se if v >= target)
        pass_pct = 100.0 * pass_n / len(se)
        longest = max(fail, key=lambda r: r["end_hz"] - r["start_hz"]) if fail else None
        rows = [
            ("Frequency band",
             f"{_fmt_freq(sweep_f_start_hz)} – {_fmt_freq(sweep_f_end_hz)}"),
            ("Spacing / points",
             f"{(sweep_request or {}).get('spacing', 'log')}  ·  {len(f)} points"),
            ("Target shielding", f"{target:g} dB"),
            ("Worst-case SE",    f"{worst_se:.2f} dB @ {_fmt_freq(worst_f)}"),
            ("Margin vs target",
             f"{'+' if margin >= 0 else '−'}{abs(margin):.2f} dB"),
            ("Band pass rate",   f"{pass_pct:.1f}%"),
            ("Longest failing range",
             "—" if longest is None else
             f"{_fmt_freq(longest['start_hz'])} – {_fmt_freq(longest['end_hz'])}"),
            ("Total thickness",  f"{sweep['total_thickness_m'] * 1e3:.3f} mm"),
            ("Layer count",      str(len((sweep_request or {}).get('layers', [])))),
        ]
        story.append(_kv_table(rows))
        story.append(Spacer(1, 6))

        story.append(_fig_image(_se_chart(f, se, target, fail)))
        story.append(Paragraph(
            "Shielding effectiveness. Shaded bands fall below the target.",
            ss["Caption"],
        ))
        story.append(_fig_image(_power_chart(f, R, T, A)))
        story.append(Paragraph("Power split at each frequency.", ss["Caption"]))

        if sweep_sensitivity:
            for key, title in (("thickness", "thickness"), ("conductivity", "conductivity")):
                block = sweep_sensitivity.get(key)
                if not block:
                    continue
                lo = block["lo"]["shielding_effectiveness_db"]
                hi = block["hi"]["shielding_effectiveness_db"]
                story.append(_fig_image(_sensitivity_chart(f, se, lo, hi, title)))
                story.append(Paragraph(
                    f"SE sensitivity to {title} (±10 %).", ss["Caption"],
                ))

        story.append(Paragraph("Failing ranges", ss["H2"]))
        if not fail:
            story.append(Paragraph(
                "The design meets the target across the whole band.", ss["Body2"],
            ))
        else:
            frows = [(_fmt_freq(r["start_hz"]), _fmt_freq(r["end_hz"]),
                      f"{(r['end_hz'] - r['start_hz']):.4g} Hz") for r in fail]
            story.append(_grid_table(
                ["From", "To", "Width"], frows,
                col_widths=(55 * mm, 55 * mm, 55 * mm),
            ))

        story.append(PageBreak())
        story.append(Paragraph(
            f"Data appendix (first {min(max_table_rows, len(f))} of {len(f)} rows)",
            ss["H2"],
        ))
        drows = []
        for i in range(min(max_table_rows, len(f))):
            drows.append((
                _fmt_freq(f[i]),
                f"{R[i]:.5f}",
                f"{T[i]:.3e}",
                f"{A[i]:.5f}",
                f"{se[i]:.2f}",
                "yes" if se[i] >= target else "no",
            ))
        story.append(_grid_table(
            ["Frequency", "R", "T", "A", "SE (dB)", "≥ target"],
            drows,
            col_widths=(30 * mm, 26 * mm, 28 * mm, 26 * mm, 26 * mm, 24 * mm),
        ))

    doc.build(story, onFirstPage=_decorate, onLaterPages=_decorate)
    return buf.getvalue()


def export_sweep_pdf(**kwargs):
    """Back-compat shim: render a sweep-only report."""
    return export_report_pdf(**kwargs)


def export_csv(*args, **kwargs):
    raise NotImplementedError("CSV export is not part of the PDF report flow.")


def export_pdf(*args, **kwargs):
    return export_report_pdf(*args, **kwargs)