import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { buildXlsxResponse } from '@/lib/excel';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const sb = createServerClient();
    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year') || new Date().getFullYear().toString();

    const { data, error } = await sb
      .from('monthly_closings')
      .select('*')
      .like('month', `${year}-%`)
      .order('month', { ascending: true });
    if (error) throw error;

    // 요약 시트
    const summaryHeader = ['월', '총 입고 수량', '총 금액(원)', '결산일', '담당자', '메모'];
    const summaryRows = (data || []).map(c => [
      c.month, c.total_quantity, c.total_price, c.closing_date, c.closed_by || '', c.notes || '',
    ]);

    const sheetData: any[][][] = [[summaryHeader, ...summaryRows]];
    const sheetNames: string[] = ['월별요약'];

    // 각 월별 상세 시트
    for (const c of (data || [])) {
      const records: any[] = Array.isArray(c.records) ? c.records : [];
      const detailHeader = ['입고일', '모델명', 'Cat. No', '수량', '총액(원)'];
      const detailRows = records.map((r: any) => [r.receiving_date, r.model_name, r.cat_no, r.quantity, r.total_price || '']);
      sheetData.push([detailHeader, ...detailRows]);
      sheetNames.push(c.month);
    }

    return buildXlsxResponse(sheetData, sheetNames, `월별결산_${year}`);
  } catch (e: any) {
    if (e.message?.includes('로그인') || e.message?.includes('관리자')) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: '내보내기 실패' }, { status: 500 });
  }
}
