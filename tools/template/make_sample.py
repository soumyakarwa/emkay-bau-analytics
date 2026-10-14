# Builds a sample workbook with made-up posts, plus a JSON file of what it contains, for the
# website's tests. The tests read the workbook with the website's reader and compare the result
# with the JSON, so the template and the reader cannot drift apart unnoticed.
#
#   python template/make_sample.py <workbook.xlsx> <expected.json> [brand]

import datetime, json, sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build_workbook import build  # noqa: E402

D = datetime.date
LI = 'https://www.linkedin.com/feed/update/urn:li:activity:{}'

TASKS = [
    ('TL', 'Thought leadership', 'Yes', 0.4, 'Yes', ''),
    ('ML', 'Market leadership', 'Yes', 0.4, 'Yes', ''),
    ('BB', 'Brand building', 'Yes', 0.2, 'Yes', ''),
    ('CO', 'Compliance', 'No', None, 'Yes', ''),
]
PEGS = [
    ('TL', 'Fact-led opinions', 'Myths vs reality', 'Yes', '', None),
    ('TL', 'Fact-led opinions', 'Research opinions', 'Yes', '', None),
    ('ML', 'Product placement', 'Performance positioning', 'Yes', '', None),
    ('BB', 'Company', 'Legacy', 'Yes', '', None),
    ('BB', 'Company', 'Old peg', 'No', 'Retired; past posts still count.', None),
    ('CO', 'Mandatory communication', 'Investor awareness', 'Yes', '', None),
]
PEG_TASK = {p[2]: p[0] for p in PEGS}
TEAM = ['Asha Rao', 'Dev Mehta']
SERIES = [('Sample series', 'A made-up series.')]

ROWS = [
    # Before the BAU start (August 2026): kept as a baseline, not counted
    dict(date=D(2026, 7, 6), peg='Research opinions', title='Baseline post', owner='Asha Rao', status='Published', LinkedIn=LI.format(1)),
    # August
    dict(date=D(2026, 8, 3), peg='Myths vs reality', title='Three myths', series='Sample series', format='Carousel', owner='Asha Rao',
         status='Published', LinkedIn=LI.format(2), Instagram='https://www.instagram.com/p/sample2/', copy='https://example.sharepoint.com/copy2'),
    dict(date=D(2026, 8, 5), peg='Performance positioning', title='Monthly performance', format='Static', owner='Dev Mehta',
         status='Published', LinkedIn=LI.format(3), X='https://x.com/sample/status/3'),
    dict(date=D(2026, 8, 5), peg='Legacy', title='Second post on the same day', format='Video', owner='Dev Mehta',
         status='Published', YouTube='https://www.youtube.com/watch?v=sample4'),
    dict(date=D(2026, 8, 7), peg='Performance positioning', title='Dropped idea', owner='Dev Mehta', status='Dropped'),
    dict(date=D(2026, 8, 10), peg='Investor awareness', title='Do not share your OTP', format='Static', owner='Asha Rao',
         status='Published', LinkedIn=LI.format(5), WhatsApp='Sent'),
    dict(date=D(2026, 8, 15), moment='Independence Day'),
    # September
    dict(date=D(2026, 9, 1), peg='Old peg', title='Post on a retired peg', format='Carousel', owner='Asha Rao',
         status='Published', LinkedIn=LI.format(6)),
    dict(date=D(2026, 9, 9), peg='Research opinions', title='Data post', details='Charts… and “quotes” & more', format='Infographic', owner='Asha Rao',
         status='Published', LinkedIn=LI.format(7), longform='https://example.sharepoint.com/article7'),
    # After "today" in the tests (13 Oct 2026): missing details are not reported
    dict(date=D(2026, 11, 2), peg='Myths vs reality', title='Planned post', LinkedIn='Planned', longform='Planned'),
]
TODAY = '2026-10-13'
BAU_START = '2026-08'


def expected(brand):
    counts = Counter()
    for r in ROWS:
        if 'peg' not in r or r.get('status') == 'Dropped' or f"{r['date']:%Y-%m}" < BAU_START:
            continue
        counts[(f"{r['date']:%Y-%m}", PEG_TASK[r['peg']])] += 1
    return {
        'brand': brand,
        'fy': 2027,
        'bauStart': BAU_START,
        'today': TODAY,
        'posts': sum(1 for r in ROWS if 'peg' in r or 'title' in r),
        'moments': sum(1 for r in ROWS if 'moment' in r and 'title' not in r),
        'counts': {f'{m}|{code}': n for (m, code), n in sorted(counts.items())},
        'commsTasks': [{'code': t[0], 'countsAsBau': t[2] == 'Yes', 'target': t[3]} for t in TASKS],
        'pegs': {p[2]: p[0] for p in PEGS},
    }


if __name__ == '__main__':
    xlsx, out = sys.argv[1], sys.argv[2]
    brand = sys.argv[3] if len(sys.argv) > 3 else 'Sample brand'
    build(xlsx, brand=brand, fy_start=2026, bau_start=D(2026, 8, 1), purpose='Made-up data for tests.',
          tasks=TASKS, pegs=PEGS, team=TEAM, series=SERIES, rows=ROWS)
    Path(out).write_text(json.dumps(expected(brand), indent=2))
