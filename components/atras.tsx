'use client';
import Link from 'next/link';
export const Atras = ({ titulo, href = '/admin/mas/' }: { titulo: string; href?: string }) => (
  <div className="mb-3 flex items-center gap-2.5">
    <Link href={href} className="rounded-xl border-[1.5px] border-line bg-white px-3.5 py-2 text-sm font-bold text-navy">‹</Link>
    <h2 className="text-lg font-bold">{titulo}</h2>
  </div>
);
