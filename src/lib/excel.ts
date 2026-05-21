import * as XLSX from 'xlsx';

export function buildXlsxResponse(data: any[][][], sheetNames: string[], filename: string): Response {
  const wb = XLSX.utils.book_new();
  data.forEach((rows, i) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const colWidths = rows[0]?.map((_: any, ci: number) =>
      Math.min(30, Math.max(10, ...rows.map((r: any[]) => String(r[ci] ?? '').length)))
    );
    ws['!cols'] = colWidths?.map((w: number) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, sheetNames[i] || `Sheet${i + 1}`);
  });

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const safeFilename = encodeURIComponent(`${filename}_${today}.xlsx`);

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${safeFilename}`,
    },
  });
}
