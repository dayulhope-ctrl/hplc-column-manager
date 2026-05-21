import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

// 칼럼 목록 조회 (팀원/관리자 모두 가능)
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const filter = searchParams.get('filter') || 'all'; // all, low_stock, need_purchase, ordered
    
    const sb = createServerClient();
    let query = sb.from('column_models').select('*').order('model_name', { ascending: true });

    if (search) {
      query = query.or(`model_name.ilike.%${search}%,cat_no.ilike.%${search}%,kep_code.ilike.%${search}%`);
    }

    if (filter === 'low_stock') {
      query = query.lte('total_stock', 2);
    } else if (filter === 'need_purchase') {
      query = query.eq('total_stock', 0).is('purchase_status', null);
    } else if (filter === 'ordered') {
      query = query.eq('purchase_status', '발주 완료');
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ columns: data || [] });
  } catch (e: any) {
    if (e.message?.includes('로그인')) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error('Columns GET error:', e);
    return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 });
  }
}

// 칼럼 추가 (관리자만)
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();

    const sb = createServerClient();
    const { data, error } = await sb
      .from('column_models')
      .insert({
        model_name: body.model_name,
        cat_no: body.cat_no,
        registration_date: body.registration_date || null,
        size: body.size || null,
        particle_size: body.particle_size || null,
        total_stock: body.total_stock || 0,
        min_safety_stock: body.min_safety_stock || 2,
        unit_price: body.unit_price || 0,
        kep_code: body.kep_code || null,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    await sb.from('activity_logs').insert({
      actor: admin.username,
      actor_type: 'admin',
      action: 'create_column',
      target_type: 'column_model',
      target_id: data.id,
      details: { model_name: data.model_name },
    });

    return NextResponse.json({ column: data });
  } catch (e: any) {
    if (e.message?.includes('관리자')) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    console.error('Columns POST error:', e);
    return NextResponse.json({ error: '칼럼 추가 실패: ' + e.message }, { status: 500 });
  }
}
