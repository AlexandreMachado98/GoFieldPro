import { UserProfile, AdminAuditLog } from '../types';

export function exportUsersToCsv(users: UserProfile[]): void {
  const headers = ['Nome', 'Email', 'Empresa', 'Telefone', 'Papel', 'Status', 'Plano', 'Status Assinatura', 'Valor (R$)', 'Vencimento', 'Criado Em'];
  const rows = users.map((u) => [
    `"${(u.name || '').replace(/"/g, '""')}"`,
    `"${(u.email || '').replace(/"/g, '""')}"`,
    `"${(u.company || '').replace(/"/g, '""')}"`,
    `"${(u.phone || '').replace(/"/g, '""')}"`,
    `"${u.role}"`,
    `"${u.status}"`,
    `"${u.subscriptionPlan || 'free'}"`,
    `"${u.subscriptionStatus || 'trial'}"`,
    `"${(u.subscriptionValue || 0).toFixed(2)}"`,
    `"${u.subscriptionExpiresAt || ''}"`,
    `"${u.createdAt || ''}"`,
  ]);

  const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
  downloadCsvFile(csvContent, `gofield_usuarios_${new Date().toISOString().split('T')[0]}.csv`);
}

export function exportFinancialSummaryToCsv(
  users: UserProfile[],
  metrics: { totalMrr: number; projectedArr: number; activeCount: number; overdueCount: number; churnRate: number }
): void {
  const summaryHeader = ['METRICA', 'VALOR'];
  const summaryRows = [
    ['MRR (Receita Recorrente Mensal)', `R$ ${metrics.totalMrr.toFixed(2)}`],
    ['ARR (Receita Recorrente Anual)', `R$ ${metrics.projectedArr.toFixed(2)}`],
    ['Total Assinantes Ativos', `${metrics.activeCount}`],
    ['Total Inadimplentes', `${metrics.overdueCount}`],
    ['Taxa de Cancelamento (Churn)', `${metrics.churnRate.toFixed(1)}%`],
    ['Data do Relatório', new Date().toLocaleDateString('pt-BR')],
  ];

  const userHeaders = ['Nome', 'Email', 'Empresa', 'Plano', 'Status', 'Valor (R$)', 'Vencimento'];
  const userRows = users
    .filter((u) => u.subscriptionStatus === 'active' || u.subscriptionStatus === 'overdue')
    .map((u) => [
      `"${(u.name || '').replace(/"/g, '""')}"`,
      `"${(u.email || '').replace(/"/g, '""')}"`,
      `"${(u.company || '').replace(/"/g, '""')}"`,
      `"${u.subscriptionPlan || ''}"`,
      `"${u.subscriptionStatus || ''}"`,
      `"${(u.subscriptionValue || 0).toFixed(2)}"`,
      `"${u.subscriptionExpiresAt || ''}"`,
    ]);

  const csvContent = [
    '--- RESUMO FINANCEIRO EXECUTIVO ---',
    summaryHeader.join(';'),
    ...summaryRows.map((r) => r.join(';')),
    '',
    '--- DETALHAMENTO DE ASSINANTES ---',
    userHeaders.join(';'),
    ...userRows.map((r) => r.join(';')),
  ].join('\n');

  downloadCsvFile(csvContent, `gofield_relatorio_financeiro_${new Date().toISOString().split('T')[0]}.csv`);
}

export function exportAuditLogsToCsv(logs: AdminAuditLog[]): void {
  const headers = ['Data/Hora', 'Administrador', 'Ação', 'Alvo', 'ID do Alvo', 'Justificativa'];
  const rows = logs.map((l) => [
    `"${new Date(l.createdAt).toLocaleString('pt-BR')}"`,
    `"${(l.adminEmail || l.adminName || '').replace(/"/g, '""')}"`,
    `"${l.action}"`,
    `"${l.targetType}"`,
    `"${l.targetId}"`,
    `"${(l.reason || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
  downloadCsvFile(csvContent, `gofield_trilha_auditoria_${new Date().toISOString().split('T')[0]}.csv`);
}

function downloadCsvFile(content: string, filename: string): void {
  // UTF-8 BOM for Excel compatibility
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
