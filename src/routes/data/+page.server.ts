import { fail } from '@sveltejs/kit';
import { FRAMEWORK_COLUMNS, FRAMEWORK_SHEET, MONTH_COLUMNS, RULES } from '$lib/core/contract';
import { getLastReport, getPublished, ingest, templateUrl } from '$lib/server/calendar';

const MAX_BYTES = 10 * 1024 * 1024;

export async function load({ locals }) {
  const [dataset, report] = await Promise.all([getPublished(), getLastReport()]);
  return {
    published: {
      source: dataset.source,
      generatedAt: dataset.generatedAt,
      months: dataset.months,
      entries: dataset.entries.length
    },
    report,
    canPublish: locals.role === 'editor',
    templateUrl,
    contract: {
      rules: RULES,
      frameworkSheet: FRAMEWORK_SHEET,
      monthColumns: MONTH_COLUMNS.map(({ header, required, description }) => ({ header, required, description })),
      frameworkColumns: FRAMEWORK_COLUMNS.map(({ header, required, description }) => ({ header, required, description }))
    }
  };
}

export const actions = {
  upload: async ({ request, locals }) => {
    if (locals.role !== 'editor') return fail(403, { message: 'Publishing needs the upload password.' });
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) return fail(400, { message: 'Choose an .xlsx file first.' });
    if (file.size > MAX_BYTES) return fail(400, { message: 'The file is larger than 10 MB. Is it the right workbook?' });
    const report = await ingest(await file.arrayBuffer(), { kind: 'upload', fileName: file.name });
    return { published: report.published };
  }
};
