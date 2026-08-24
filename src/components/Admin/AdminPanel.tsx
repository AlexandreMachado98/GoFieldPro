import React, { useEffect, useState, useCallback } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { UserProfile, UserRole, UserStatus } from '../../types';
import {
  Users,
  Shield,
  UserCog,
  Mail,
  Calendar,
  CheckCircle2,
  Clock,
  ShieldAlert,
  UserCheck,
  UserX,
  Trash2,
  Phone,
  Building2,
  Search,
  Check,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  UserPlus,
  Plus,
  X,
  Briefcase
} from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const { profile } = useAuth();
  const { notifySuccess, notifyError, showConfirm } = useApp();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString('pt-BR'));
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'active' | 'blocked'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State for Adding/Pre-authorizing users
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserCompany, setNewUserCompany] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('surveyor');
  const [newUserStatus, setNewUserStatus] = useState<UserStatus>('active');
  const [savingUser, setSavingUser] = useState(false);

  const handleCreateOrAuthorizeUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim()) {
      notifyError("Campo Obrigatório", "Por favor, informe o e-mail do colaborador.");
      return;
    }
    setSavingUser(true);
    try {
      const emailClean = newUserEmail.trim().toLowerCase();
      const existingUser = users.find(u => u.email.toLowerCase() === emailClean);
      const targetUid = existingUser ? existingUser.uid : `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const userRef = doc(db, 'users', targetUid);

      const newUserData: UserProfile = {
        uid: targetUid,
        email: emailClean,
        name: newUserName.trim() || emailClean.split('@')[0] || 'Operador de Campo',
        role: newUserRole,
        status: newUserStatus,
        company: newUserCompany.trim() || 'AM TST SAÚDE E SEGURANÇA DO TRABALHO',
        phone: newUserPhone.trim(),
        requestedRole: newUserRole,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newUserName.trim() || emailClean)}&background=0284c7&color=fff`,
        createdAt: existingUser?.createdAt || new Date().toISOString(),
        approvedAt: newUserStatus === 'active' ? new Date().toISOString() : undefined,
        approvedBy: newUserStatus === 'active' ? (profile?.name || 'Administrador') : undefined,
      };

      await setDoc(userRef, newUserData, { merge: true });
      notifySuccess(
        newUserStatus === 'active' ? "Usuário Liberado com Sucesso!" : "Solicitação Registrada!",
        `${newUserData.name} (${newUserData.email}) foi salvo no banco de dados.`
      );
      setIsAddUserModalOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserCompany('');
      setNewUserPhone('');
      setNewUserRole('surveyor');
      setNewUserStatus('active');
      manualSync();
    } catch (err: any) {
      console.error("Error creating user:", err);
      notifyError("Erro ao Salvar", "Não foi possível registrar o usuário no banco de dados.");
    } finally {
      setSavingUser(false);
    }
  };

  const parseUsersSnapshot = (snapshotDocs: any[]): UserProfile[] => {
    const usersData = snapshotDocs.map((docSnap) => {
      const data = typeof docSnap.data === 'function' ? docSnap.data() : docSnap;
      const isOwner = (data.email || '').toLowerCase() === 'alexandre1604981@gmail.com';
      return {
        uid: docSnap.id || data.uid,
        email: data.email || '',
        name: data.name || data.email?.split('@')[0] || 'Usuário',
        role: isOwner ? 'super_admin' : ((data.role as UserRole) || 'surveyor'),
        status: isOwner ? 'active' : ((data.status as UserStatus) || 'pending'),
        company: data.company || '',
        phone: data.phone || '',
        requestedRole: data.requestedRole || data.role || 'surveyor',
        avatar: data.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'U')}&background=0284c7&color=fff`,
        createdAt: data.createdAt || new Date().toISOString(),
        approvedAt: data.approvedAt,
        approvedBy: data.approvedBy,
      } as UserProfile;
    });

    usersData.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return usersData;
  };

  const manualSync = useCallback(async () => {
    setRefreshing(true);
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const list = parseUsersSnapshot(snapshot.docs);
      setUsers(list);
      setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
      notifySuccess("Sincronização Concluída", `${list.length} usuário(s) sincronizados com o banco de dados.`);
    } catch (err: any) {
      console.error("Manual sync error:", err);
      notifyError("Erro de Sincronização", "Não foi possível carregar a lista de usuários.");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [notifySuccess, notifyError]);

  // Real-time synchronization of all registered users
  useEffect(() => {
    if (profile?.role !== 'super_admin') {
      setLoading(false);
      return;
    }

    const usersRef = collection(db, 'users');
    const unsubscribe = onSnapshot(
      usersRef,
      (snapshot) => {
        const usersData = parseUsersSnapshot(snapshot.docs);
        setUsers(usersData);
        setLastSyncTime(new Date().toLocaleTimeString('pt-BR'));
        setLoading(false);
      },
      (error) => {
        console.error("Error with real-time users listener:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profile]);

  const handleApproveUser = async (userToApprove: UserProfile, assignedRole?: UserRole) => {
    try {
      const userRef = doc(db, 'users', userToApprove.uid);
      const roleToSet = assignedRole || userToApprove.requestedRole || userToApprove.role || 'surveyor';
      await updateDoc(userRef, {
        status: 'active',
        role: roleToSet,
        approvedAt: new Date().toISOString(),
        approvedBy: profile?.name || 'Administrador',
      });
      notifySuccess("Acesso Liberado!", `${userToApprove.name} agora tem acesso ao GoField Pro.`);
    } catch (error) {
      console.error("Error approving user:", error);
      notifyError("Falha na Liberação", "Não foi possível liberar o acesso do usuário.");
    }
  };

  const handleBlockUser = async (userToBlock: UserProfile) => {
    showConfirm({
      title: 'Bloquear Acesso?',
      message: `Deseja suspender temporariamente o acesso de ${userToBlock.name}? Ele não conseguirá sincronizar nem acessar o mapa.`,
      confirmText: 'Bloquear Usuário',
      cancelText: 'Cancelar',
      type: 'warning',
      onConfirm: async () => {
        try {
          const userRef = doc(db, 'users', userToBlock.uid);
          await updateDoc(userRef, { status: 'blocked' });
          notifySuccess("Usuário Bloqueado", `O acesso de ${userToBlock.name} foi bloqueado.`);
        } catch (error) {
          console.error("Error blocking user:", error);
          notifyError("Erro ao bloquear", "Não foi possível alterar o status do usuário.");
        }
      },
    });
  };

  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { role: newRole });
      notifySuccess("Nível de Acesso Atualizado", `Permissão alterada com sucesso.`);
    } catch (error) {
      console.error("Error updating role:", error);
      notifyError("Falha na Permissão", "Não foi possível atualizar o nível de acesso.");
    }
  };

  const handleDeleteUser = async (userToDelete: UserProfile) => {
    showConfirm({
      title: 'Excluir Cadastro?',
      message: `Tem certeza que deseja remover permanentemente o cadastro de ${userToDelete.name} (${userToDelete.email})?`,
      confirmText: 'Excluir Cadastro',
      cancelText: 'Cancelar',
      type: 'danger',
      onConfirm: async () => {
        try {
          const userRef = doc(db, 'users', userToDelete.uid);
          await deleteDoc(userRef);
          notifySuccess("Cadastro Removido", `O registro de ${userToDelete.name} foi apagado.`);
        } catch (error) {
          console.error("Error deleting user:", error);
          notifyError("Erro ao excluir", "Não foi possível remover o registro do usuário.");
        }
      },
    });
  };

  if (profile?.role !== 'super_admin') {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md text-center">
          <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Acesso Negado</h2>
          <p className="text-slate-400 text-sm">
            Você não possui permissões de Administrador para acessar o painel de controle de usuários.
          </p>
        </div>
      </div>
    );
  }

  const pendingUsers = users.filter((u) => u.status === 'pending');
  const activeUsers = users.filter((u) => u.status === 'active');
  const blockedUsers = users.filter((u) => u.status === 'blocked');

  const filteredUsers = users.filter((u) => {
    if (filterStatus === 'pending') return u.status === 'pending';
    if (filterStatus === 'active') return u.status === 'active';
    if (filterStatus === 'blocked') return u.status === 'blocked';
    return true;
  }).filter((u) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      u.name?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query) ||
      u.company?.toLowerCase().includes(query) ||
      u.phone?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-5 space-y-5 max-w-6xl mx-auto text-slate-100 pb-32 sm:pb-20">
      {/* Header Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div>
          <h2 className="font-extrabold text-lg sm:text-xl text-white flex items-center gap-2.5">
            <UserCog className="w-6 h-6 text-sky-400 shrink-0" />
            Controle de Acessos & Equipe
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Libere novos cadastros de operadores, atribua cargos e gerencie a equipe de campo em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsAddUserModalOpen(true)}
            className="bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95 shadow-lg shadow-sky-950/40"
          >
            <UserPlus className="w-4 h-4" />
            <span>Cadastrar / Liberar Usuário</span>
          </button>
          <button
            onClick={manualSync}
            disabled={refreshing}
            className="bg-slate-950 hover:bg-slate-800 border border-slate-700/80 hover:border-sky-500/60 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-bold text-sky-400 transition-all active:scale-95 shadow-md"
            title="Forçar sincronização imediata com o Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-sky-300' : ''}`} />
            <span>{refreshing ? 'Sincronizando...' : 'Sincronizar Banco'}</span>
            <span className="text-[10px] text-slate-500 font-normal ml-0.5">({lastSyncTime})</span>
          </button>
          <div className="bg-amber-950/60 border border-amber-800/80 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-bold text-amber-300">
            <Clock className="w-4 h-4" />
            <span>{pendingUsers.length} Pendentes</span>
          </div>
          <div className="bg-emerald-950/60 border border-emerald-800/80 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-300">
            <CheckCircle2 className="w-4 h-4" />
            <span>{activeUsers.length} Ativos</span>
          </div>
        </div>
      </div>

      {/* PENDING APPROVALS ALERT BANNER (If any users are waiting) */}
      {pendingUsers.length > 0 && (
        <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border-2 border-amber-500/60 p-4 sm:p-5 rounded-2xl shadow-2xl space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-amber-300">
                  {pendingUsers.length} {pendingUsers.length === 1 ? 'Solicitação de Acesso Aguardando Liberação' : 'Solicitações de Acesso Aguardando Liberação'}
                </h3>
                <p className="text-xs text-amber-200/80">
                  Novos operadores se cadastraram no aplicativo e precisam que você libere o acesso.
                </p>
              </div>
            </div>
            <button
              onClick={() => setFilterStatus('pending')}
              className="hidden sm:inline-flex text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all"
            >
              Ver Todas
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {pendingUsers.map((pendingUser) => (
              <div
                key={pendingUser.uid}
                className="bg-slate-950/90 border border-amber-500/40 p-4 rounded-xl flex flex-col justify-between gap-3 shadow-lg hover:border-amber-400 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <img
                      src={pendingUser.avatar}
                      alt={pendingUser.name}
                      className="w-10 h-10 rounded-full border-2 border-amber-500/60 object-cover shrink-0"
                    />
                    <div>
                      <div className="font-bold text-sm text-white flex items-center gap-2">
                        <span>{pendingUser.name}</span>
                        <span className="text-[10px] px-2 py-0.2 bg-amber-900/60 border border-amber-700 text-amber-300 rounded-md font-semibold">
                          Novo
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span>{pendingUser.email}</span>
                      </div>
                      {pendingUser.company && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-500" />
                          <span>{pendingUser.company}</span>
                        </div>
                      )}
                      {pendingUser.phone && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span>{pendingUser.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-400">
                    Função pedida: <span className="font-bold text-sky-400">
                      {pendingUser.requestedRole === 'field_lead' ? 'Líder de Equipe' :
                       pendingUser.requestedRole === 'auditor' ? 'Auditor' : 'Coletor de Campo'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleApproveUser(pendingUser)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md active:scale-95 transition-all"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Liberar Acesso</span>
                    </button>
                    <button
                      onClick={() => handleDeleteUser(pendingUser)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
                      title="Recusar cadastro"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-3 sm:p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
              filterStatus === 'all'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            Todos ({users.length})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              filterStatus === 'pending'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Pendentes ({pendingUsers.length})
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              filterStatus === 'active'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Ativos ({activeUsers.length})
          </button>
          <button
            onClick={() => setFilterStatus('blocked')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              filterStatus === 'blocked'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Bloqueados ({blockedUsers.length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, e-mail..."
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>
      </div>

      {/* Main Users List (Cards on Mobile, Rich Table on Desktop) */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-slate-900 border border-slate-800 p-12 rounded-2xl text-center text-slate-400 space-y-2">
            <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-semibold">Carregando usuários do Firebase em tempo real...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 p-12 rounded-2xl text-center text-slate-400 space-y-2">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <h4 className="font-bold text-white text-sm">Nenhum usuário encontrado</h4>
            <p className="text-xs text-slate-500">
              {searchQuery ? 'Tente ajustar os termos da sua busca.' : 'Não há registros com o filtro selecionado.'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filteredUsers.map((u) => {
                const isPending = u.status === 'pending';
                const isBlocked = u.status === 'blocked';
                const isSelf = u.uid === profile?.uid;

                return (
                  <div
                    key={u.uid}
                    className={`bg-slate-900 border rounded-2xl p-4 shadow-lg space-y-3 ${
                      isPending
                        ? 'border-amber-500/50 bg-slate-900/90'
                        : isBlocked
                        ? 'border-rose-900/50 opacity-80'
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <img
                          src={u.avatar}
                          alt={u.name}
                          className="w-10 h-10 rounded-full border border-slate-700 object-cover shrink-0"
                        />
                        <div>
                          <div className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                            <span>{u.name}</span>
                            {isSelf && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-sky-950 text-sky-400 border border-sky-800 rounded font-semibold">
                                Você
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-slate-500" />
                            <span className="truncate max-w-[190px]">{u.email}</span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider shrink-0 ${
                          isPending
                            ? 'bg-amber-950 text-amber-300 border-amber-800'
                            : isBlocked
                            ? 'bg-rose-950 text-rose-300 border-rose-800'
                            : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        }`}
                      >
                        {isPending ? 'Pendente' : isBlocked ? 'Bloqueado' : 'Ativo'}
                      </span>
                    </div>

                    {/* Role selector */}
                    <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold text-slate-400">Nível de Acesso (Cargo):</label>
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                        disabled={isSelf}
                        className={`w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-sky-500 transition-colors ${
                          isSelf ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <option value="super_admin">Super Admin (Acesso Total)</option>
                        <option value="field_lead">Líder de Campo (Gestão e Edição)</option>
                        <option value="surveyor">Coletor (GPS, Trilhas, Alfinetes)</option>
                        <option value="auditor">Auditor (Somente Leitura)</option>
                      </select>
                    </div>

                    {/* Action buttons */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <div className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(u.createdAt).toLocaleDateString('pt-BR')}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isPending && (
                          <button
                            onClick={() => handleApproveUser(u)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Liberar</span>
                          </button>
                        )}

                        {!isPending && !isSelf && (
                          <button
                            onClick={() => (isBlocked ? handleApproveUser(u) : handleBlockUser(u))}
                            className={`p-1.5 rounded-lg border text-xs font-bold transition-all ${
                              isBlocked
                                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                                : 'bg-slate-800 hover:bg-amber-950/60 border-slate-700 text-slate-400 hover:text-amber-300'
                            }`}
                            title={isBlocked ? 'Desbloquear usuário' : 'Suspender/Bloquear'}
                          >
                            {isBlocked ? <CheckCircle2 className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                          </button>
                        )}

                        {!isSelf && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
                            title="Excluir cadastro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 text-xs">
                    <tr>
                      <th className="px-4 py-3.5 font-bold">Usuário / Nome</th>
                      <th className="px-4 py-3.5 font-bold">Contato / Empresa</th>
                      <th className="px-4 py-3.5 font-bold">Status</th>
                      <th className="px-4 py-3.5 font-bold">Nível de Acesso (Role)</th>
                      <th className="px-4 py-3.5 font-bold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredUsers.map((u) => {
                      const isPending = u.status === 'pending';
                      const isBlocked = u.status === 'blocked';
                      const isSelf = u.uid === profile?.uid;

                      return (
                        <tr
                          key={u.uid}
                          className={`hover:bg-slate-800/50 transition-colors ${
                            isPending ? 'bg-amber-950/20' : ''
                          }`}
                        >
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <img
                                src={u.avatar}
                                alt={u.name}
                                className="w-9 h-9 rounded-full border border-slate-700 object-cover shrink-0"
                              />
                              <div>
                                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                                  <span>{u.name}</span>
                                  {isSelf && (
                                    <span className="text-[10px] px-1.5 py-0.2 bg-sky-950 text-sky-400 border border-sky-800 rounded font-semibold">
                                      Você
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-slate-500" />
                                  <span>Cadastrado em {new Date(u.createdAt).toLocaleDateString('pt-BR')}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="text-xs text-slate-300 space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5 text-slate-500" />
                                <span>{u.email}</span>
                              </div>
                              {u.company && (
                                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                                  <Building2 className="w-3 h-3 text-slate-500" />
                                  <span>{u.company}</span>
                                </div>
                              )}
                              {u.phone && (
                                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                                  <Phone className="w-3 h-3 text-slate-500" />
                                  <span>{u.phone}</span>
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                                isPending
                                  ? 'bg-amber-950 text-amber-300 border-amber-800'
                                  : isBlocked
                                  ? 'bg-rose-950 text-rose-300 border-rose-800'
                                  : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                              }`}
                            >
                              {isPending && <Clock className="w-3.5 h-3.5" />}
                              {isBlocked && <ShieldAlert className="w-3.5 h-3.5" />}
                              {!isPending && !isBlocked && <CheckCircle2 className="w-3.5 h-3.5" />}
                              <span>{isPending ? 'Aguardando Liberação' : isBlocked ? 'Bloqueado' : 'Ativo'}</span>
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                              disabled={isSelf}
                              className={`bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none focus:border-sky-500 transition-colors ${
                                isSelf ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                            >
                              <option value="super_admin">Super Admin (Total)</option>
                              <option value="field_lead">Líder de Campo</option>
                              <option value="surveyor">Coletor de Campo</option>
                              <option value="auditor">Auditor (Leitura)</option>
                            </select>
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isPending ? (
                                <button
                                  onClick={() => handleApproveUser(u)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>Liberar Acesso</span>
                                </button>
                              ) : (
                                !isSelf && (
                                  <button
                                    onClick={() => (isBlocked ? handleApproveUser(u) : handleBlockUser(u))}
                                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1 ${
                                      isBlocked
                                        ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300 hover:bg-emerald-900/80'
                                        : 'bg-slate-800 hover:bg-amber-950/60 border-slate-700 text-slate-300 hover:text-amber-300'
                                    }`}
                                    title={isBlocked ? 'Desbloquear usuário' : 'Suspender acesso'}
                                  >
                                    {isBlocked ? <CheckCircle2 className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                                    <span>{isBlocked ? 'Reativar' : 'Bloquear'}</span>
                                  </button>
                                )
                              )}

                              {!isSelf && (
                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
                                  title="Excluir cadastro"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal: Cadastrar / Liberar Usuário Manualmente */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Cadastrar / Liberar Usuário</h3>
                  <p className="text-xs text-slate-400">Adicione ou pré-aprove o acesso de um colaborador.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrAuthorizeUser} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                  E-mail do Colaborador *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="colaborador@empresa.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Se o usuário já tentou se cadastrar com este e-mail, seu status será liberado instantaneamente.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                    Empresa / Órgão
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={newUserCompany}
                      onChange={(e) => setNewUserCompany(e.target.value)}
                      placeholder="AM TST Engenharia"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                    Telefone / WhatsApp
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={newUserPhone}
                      onChange={(e) => setNewUserPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                    Cargo / Nível de Acesso
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 transition-colors"
                  >
                    <option value="surveyor">Coletor de Campo (GPS, Trilhas)</option>
                    <option value="field_lead">Líder de Equipe (Edição)</option>
                    <option value="auditor">Auditor (Leitura)</option>
                    <option value="super_admin">Super Admin (Total)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                    Status Inicial
                  </label>
                  <select
                    value={newUserStatus}
                    onChange={(e) => setNewUserStatus(e.target.value as UserStatus)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 transition-colors"
                  >
                    <option value="active">Liberado Imediatamente (Ativo)</option>
                    <option value="pending">Aguardando Aprovação (Pendente)</option>
                    <option value="blocked">Bloqueado</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 disabled:bg-sky-800 text-white transition-all shadow-lg flex items-center gap-1.5"
                >
                  {savingUser ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{newUserStatus === 'active' ? 'Liberar Acesso Agora' : 'Salvar Cadastro'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Corporate Copyright Footer */}
      <footer className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-400">GoField Pro</span>
          <span>•</span>
          <span>AM TST SAÚDE E SEGURANÇA DO TRABALHO</span>
        </div>
        <a
          href="https://amtst.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-400 hover:text-sky-300 font-medium hover:underline transition-colors"
        >
          https://amtst.vercel.app/
        </a>
      </footer>
    </div>
  );
};
