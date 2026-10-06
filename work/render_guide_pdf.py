from pathlib import Path
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageBreak, PageTemplate, Paragraph, Spacer,
    Table, TableStyle, KeepTogether,
)

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "work" / "changchun_museums_guide.md"
OUTPUT = ROOT / "outputs" / "长春线下博物馆实用全攻略.pdf"

pdfmetrics.registerFont(TTFont("Hiragino", str(ROOT / "work" / "HiraginoSansGB-W3.ttf")))
FONT = "Hiragino"
PAGE_W, PAGE_H = A4
NAVY = colors.HexColor("#173F5F")
TEAL = colors.HexColor("#177E89")
INK = colors.HexColor("#253746")
MUTED = colors.HexColor("#657786")
PALE = colors.HexColor("#EAF2F5")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="TitleCN", parent=styles["Title"], fontName=FONT, fontSize=25,
    leading=34, textColor=NAVY, alignment=TA_CENTER, spaceAfter=18))
styles.add(ParagraphStyle(name="SubtitleCN", fontName=FONT, fontSize=11, leading=18,
    textColor=MUTED, alignment=TA_CENTER))
styles.add(ParagraphStyle(name="H1CN", parent=styles["Heading1"], fontName=FONT, fontSize=17,
    leading=25, textColor=NAVY, spaceBefore=18, spaceAfter=10, keepWithNext=True))
styles.add(ParagraphStyle(name="H2CN", parent=styles["Heading2"], fontName=FONT, fontSize=13,
    leading=20, textColor=TEAL, spaceBefore=13, spaceAfter=7, keepWithNext=True))
styles.add(ParagraphStyle(name="BodyCN", fontName=FONT, fontSize=9.5, leading=16,
    textColor=INK, alignment=TA_JUSTIFY, spaceAfter=6))
styles.add(ParagraphStyle(name="BulletCN", parent=styles["BodyCN"], leftIndent=13, firstLineIndent=-10,
    bulletIndent=2, spaceAfter=4))
styles.add(ParagraphStyle(name="SmallCN", parent=styles["BodyCN"], fontSize=8.2, leading=12.5,
    textColor=INK, spaceAfter=2))
styles.add(ParagraphStyle(name="QuoteCN", parent=styles["BodyCN"], backColor=PALE,
    borderColor=TEAL, borderWidth=0, borderPadding=8, leftIndent=5, rightIndent=5, spaceBefore=5, spaceAfter=8))

def inline(text):
    text = text.strip()
    text = re.sub(r"\*\*(.*?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"\[(.*?)\]\((.*?)\)", r'<a href="\2" color="#177E89">\1</a>', text)
    text = text.replace("&", "&amp;")
    text = text.replace("&amp;lt;", "&lt;").replace("&amp;gt;", "&gt;")
    return text

def para(text, style="BodyCN", bullet=None):
    return Paragraph(inline(text), styles[style], bulletText=bullet)

def make_table(lines):
    rows = []
    for line in lines:
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-{3,}:?", c) for c in cells):
            continue
        rows.append(cells)
    if not rows:
        return None
    cols = len(rows[0])
    widths = {
        3: [3.0*cm, 5.2*cm, 8.0*cm],
        4: [2.7*cm, 4.2*cm, 4.2*cm, 5.1*cm],
    }.get(cols, [16.4*cm/cols]*cols)
    data = []
    for r, row in enumerate(rows):
        row = (row + [""] * cols)[:cols]
        style = "SmallCN" if r else "SmallCN"
        data.append([para(cell, style) for cell in row])
    t = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    cmds = [
        ("BACKGROUND", (0,0), (-1,0), NAVY),
        ("TEXTCOLOR", (0,0), (-1,0), colors.white),
        ("FONTNAME", (0,0), (-1,-1), FONT),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("GRID", (0,0), (-1,-1), 0.25, colors.HexColor("#B8C8D2")),
        ("LEFTPADDING", (0,0), (-1,-1), 5), ("RIGHTPADDING", (0,0), (-1,-1), 5),
        ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5),
    ]
    for r in range(1, len(data)):
        if r % 2 == 0:
            cmds.append(("BACKGROUND", (0,r), (-1,r), colors.HexColor("#F5F8FA")))
    t.setStyle(TableStyle(cmds))
    return t

def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#C6D7DF"))
    canvas.line(2.0*cm, PAGE_H-1.35*cm, PAGE_W-2.0*cm, PAGE_H-1.35*cm)
    canvas.setFont(FONT, 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(2.0*cm, PAGE_H-1.05*cm, "长春线下博物馆实用全攻略")
    canvas.drawRightString(PAGE_W-2.0*cm, 1.0*cm, f"第 {doc.page} 页")
    canvas.restoreState()

def cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.HexColor("#F5F9FA"))
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    canvas.setStrokeColor(TEAL)
    canvas.setLineWidth(2)
    canvas.line(3*cm, 7*cm, PAGE_W-3*cm, 7*cm)
    canvas.restoreState()

def build_story():
    lines = SOURCE.read_text(encoding="utf-8").splitlines()
    story = []
    title_seen = False
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1; continue
        if line.startswith("# "):
            if not title_seen:
                story += [Spacer(1, 5.2*cm), para(line[2:], "TitleCN"),
                          para("核验时间：2026年9月29日", "SubtitleCN"),
                          Spacer(1, 0.25*cm), para("长春主城区、净月区及县域可到达馆舍", "SubtitleCN"),
                          Spacer(1, 1.0*cm), para("一份可以直接带着出门的看馆、预约与路线资料", "SubtitleCN"), PageBreak()]
                title_seen = True
            i += 1; continue
        if line.startswith("> "):
            story.append(para(line[2:], "QuoteCN")); i += 1; continue
        if line.startswith("## "):
            story.append(para(line[3:], "H1CN")); i += 1; continue
        if line.startswith("### "):
            story.append(para(line[4:], "H2CN")); i += 1; continue
        if line.startswith("|"):
            table_lines = []
            while i < len(lines) and lines[i].startswith("|"):
                table_lines.append(lines[i]); i += 1
            tbl = make_table(table_lines)
            if tbl: story += [tbl, Spacer(1, 0.18*cm)]
            continue
        if re.match(r"^- ", line):
            story.append(para(line[2:], "BulletCN", "•")); i += 1; continue
        if re.match(r"^\d+\. ", line):
            m = re.match(r"^(\d+\. )(.+)", line)
            story.append(para(m.group(2), "BulletCN", m.group(1))); i += 1; continue
        story.append(para(line, "BodyCN")); i += 1
    return story

def main():
    frame = Frame(2*cm, 1.5*cm, PAGE_W-4*cm, PAGE_H-3.2*cm, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc = BaseDocTemplate(str(OUTPUT), pagesize=A4, leftMargin=2*cm, rightMargin=2*cm, topMargin=1.7*cm, bottomMargin=1.5*cm)
    doc.addPageTemplates([PageTemplate(id="Normal", frames=frame, onPage=header_footer)])
    doc.build(build_story())

if __name__ == "__main__":
    main()
