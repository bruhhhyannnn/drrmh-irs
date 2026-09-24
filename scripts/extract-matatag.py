"""Rebuild the reviewed MATATAG question bank from the supplied printable PDF.

Usage: python scripts/extract-matatag.py path/to/source.pdf
Requires PyMuPDF. No PDF is modified.
"""
import json
import re
import sys
from pathlib import Path

import pymupdf

document = pymupdf.open(sys.argv[1])
sections = []
section = None
item = None
for page_number, page in enumerate(document):
    if page_number == 0 or page_number == len(document) - 1:
        continue
    body = page.get_text().split('This checklist was developed')[0]
    for raw in body.splitlines():
        line = raw.replace('\u200b', '').strip()
        if not line or line in ('YES', 'NO', 'N/A') or line.startswith(('Remarks:', 'TOTAL')):
            continue
        heading = re.match(r'^([IVX]+)\. (.+)', line)
        if heading:
            # The final summary row at the top of page 2 is not a section.
            if heading[1] == 'XVII' and not sections:
                continue
            section = {'id': heading[1], 'heading': heading[2], 'page': page_number + 1, 'items': []}
            sections.append(section)
            item = None
            continue
        if section is None:
            continue
        question = re.match(r'^(\d+(?:\.\d+)?)(\*)?(?:\s+(.*))?$', line)
        if question:
            item = {'number': question[1], 'starred': bool(question[2]), 'text': question[3] or '', 'page': page_number + 1}
            section['items'].append(item)
        elif item is not None:
            item['text'] = (item['text'] + ' ' + line).strip()
        else:
            section['heading'] += ' ' + line

for section in sections:
    heading = section.pop('heading')
    title, _, translation = heading.partition(' (')
    section['title'] = title
    section['translation'] = translation.rstrip(')')
    for item in section['items']:
        item['id'] = section['id'] + '-' + item['number']
        item['group'] = any(other['number'].startswith(item['number'] + '.') for other in section['items'])
        # Keep the original bilingual text and references together without paraphrasing.
        assert item['text'], item['id']
    expected = list(range(1, max(int(i['number']) for i in section['items'] if '.' not in i['number']) + 1))
    assert [int(i['number']) for i in section['items'] if '.' not in i['number']] == expected

assert len(sections) == 17
output = Path('src/lib/matatag-checklist.json')
output.write_text(json.dumps(sections, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
for section in sections:
    print(section['id'], section['title'], len(section['items']), 'rows')
print('Answerable items:', sum(not i['group'] for s in sections for i in s['items']))
