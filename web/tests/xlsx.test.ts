// The .xlsx reader on hand-built files, for cases the template never writes itself.

import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { readXlsx } from '../src/lib/workbook/xlsx';

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

function workbook(sharedStrings: string[], cells: string): Uint8Array {
  return zipSync({
    'xl/workbook.xml': strToU8(`<workbook ${NS}><sheets><sheet name="Sheet" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '</Relationships>'
    ),
    'xl/sharedStrings.xml': strToU8(`<sst ${NS}>${sharedStrings.map((s) => `<si><t>${s}</t></si>`).join('')}</sst>`),
    'xl/worksheets/sheet1.xml': strToU8(`<worksheet ${NS}><sheetData><row r="1">${cells}</row></sheetData></worksheet>`)
  });
}

describe('the .xlsx reader', () => {
  it('decodes character references that some tools write instead of the character', () => {
    const [sheet] = readXlsx(workbook(['What does one ball cost&#8230;..(US &amp; Open) &#x201C;x&#x201D;'], '<c r="A1" t="s"><v>0</v></c>'));
    expect(sheet.cell(1, 1).value).toBe('What does one ball cost…..(US & Open) “x”');
  });

  it('tells formula cells from typed ones, and keeps the saved result', () => {
    const [sheet] = readXlsx(workbook([], '<c r="A1"><f>1+1</f><v>2</v></c><c r="B1" t="str"><f>"T"&amp;"L"</f><v>TL</v></c><c r="C1"><v>5</v></c>'));
    expect(sheet.cell(1, 1)).toEqual({ value: 2, formula: true, url: null });
    expect(sheet.cell(1, 2)).toEqual({ value: 'TL', formula: true, url: null });
    expect(sheet.cell(1, 3)).toEqual({ value: 5, formula: false, url: null });
  });

  it('refuses a file that is not a workbook', () => {
    expect(() => readXlsx(strToU8('not a zip'))).toThrow('not a valid .xlsx');
  });
});
