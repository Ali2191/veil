#!/usr/bin/env python3
"""Builds VEIL's name and place dictionaries from open data.

Sources (all openly licensed):
  - Wikidata given names (male Q12308941, female Q11879590, unisex Q3409032), CC0
  - Wikidata family names (Q101352) with >= 3 Wikipedia sitelinks, CC0
  - GeoNames cities15000 (cities with population > 15,000), CC BY 4.0
  - google-10000-english (common English words), used only to *exclude* ordinary words

Usage: python3 tools/build-dictionaries.py <raw-data-dir>
Writes lib/data/{given,family,places}.txt (one lowercase entry per line).
"""
import csv, io, os, re, sys, unicodedata, zipfile

RAW = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'lib', 'data')

common = {w.strip().lower() for w in open(os.path.join(RAW, 'common10k.txt')) if w.strip()}
# Everyday words that are also names but too ambiguous to flag on their own.
common |= set('will may june april august mark grace hope faith joy rose bill pat jack frank sunny summer amber '
              'iman noor art guy victor lane dawn eve ray rob sue don ken penny ruby holly daisy lily max sky storm '
              'sage jay dean hazel iris violet river chase hunter mason carter price rich hill king young white green '
              'bell wood long brown gray grey cook reed ward cox walker baker turner parker cooper foster'.split())

LATIN_OR_ARABIC = re.compile(r"^[\w'’\-]+$", re.UNICODE)

def clean(label):
    s = unicodedata.normalize('NFC', label.strip())
    if not s or ' ' in s or len(s) < 2 or len(s) > 20: return None
    if any(ch.isdigit() for ch in s): return None
    if not LATIN_OR_ARABIC.match(s): return None
    return s.lower()

def read_csv(name):
    with open(os.path.join(RAW, name), encoding='utf-8') as f:
        r = csv.reader(f); next(r, None)
        for row in r:
            if row: yield row[0]

given = set()
for f in ('given_Q12308941.csv', 'given_Q11879590.csv', 'given_Q3409032.csv'):
    for l in read_csv(f):
        c = clean(l)
        if c and c not in common: given.add(c)

family = set()
for l in read_csv('family.csv'):
    c = clean(l)
    if c and c not in common: family.add(c)

places = set()
with zipfile.ZipFile(os.path.join(RAW, 'cities15000.zip')) as z:
    with z.open('cities15000.txt') as f:
        for line in io.TextIOWrapper(f, encoding='utf-8'):
            cols = line.split('\t')
            for n in (cols[1], cols[2]):
                n = unicodedata.normalize('NFC', n.strip()).lower()
                if 2 < len(n) <= 40 and n not in common: places.add(n)

os.makedirs(OUT, exist_ok=True)
for name, data in (('given', given), ('family', family), ('places', places)):
    with open(os.path.join(OUT, f'{name}.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(sorted(data)) + '\n')
    print(name, len(data))
