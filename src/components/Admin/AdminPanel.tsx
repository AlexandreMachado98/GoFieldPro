import React, { useEffect, useState, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import {
  UserProfile,
  UserRole,
  UserStatus,
  SubscriptionPlanType,
  SubscriptionStatusType,
  PromoCoupon,
  SystemBillingConfig,
  PlanItemConfig,
} from '../../types';
import { testAsaasConnection } from '../../utils/asaasGateway';
import {
  Users,
  Shield,
  UserCog,
  Mail,
  Calendar,
  CheckCircle2,
  Clock,
  UserCheck,
  UserX,
  Trash2,
  Phone,
  Building2,
  Search,
  Check,
  RefreshCw,
  Sparkles,
  UserPlus,
  Plus,
  X,
  DollarSign,
  TrendingUp,
  Send,
  Lock,
  Unlock,
  Tag,
  Gift,
  Settings,
  QrCode,
  AlertCircle,
  Edit3,
  Percent,
  Eye,
  EyeOff,
  Zap,
} from 'lucide-react';

export const DEFAULT_PLANS: PlanItemConfig[] = [
  {
    id: 'pro',
    name: 'Plano Profissional',
    tag: 'Individual',
    originalPrice: 149,
    price: 97,
    discountBadge: '35% OFF',
    billingPeriod: '/mês',
    features: [
      '1 Operador de Campo',
      'Mapas PDF e GPS Ilimitados',
      'Medição de Pilha de Madeira (m³)',
      'Relatórios Técnicos em PDF com Fotos',
    ],
    highlight: false,
  },
  {
    id: 'equipe',
    name: 'Plano Equipe',
    tag: 'Mais Popular',
    originalPrice: 390,
    price: 289,
    discountBadge: 'Economize R$ 101/mês',
    billingPeriod: '/mês',
    features: [
      'Até 5 Técnicos de Campo',
      'Painel de Gestão da Frota & Odômetro',
      'Cubagem Florestal e Laudos em Lote',
      'Backup e Sincronização em Nuvem',
    ],
    highlight: true,
  },
  {
    id: 'florestal',
    name: 'Florestal & Usinas',
    tag: 'Corporativo',
    originalPrice: 950,
    price: 690,
    discountBadge: '27% OFF',
    billingPeriod: '/mês',
    features: [
      '15 a 30 Operadores simultâneos',
      'Logotipo da Empresa nos Laudos PDF',
      'Contratos e Faturamento PJ',
      'Treinamento e Suporte VIP Prioritário',
    ],
    highlight: false,
  },
];

const DEFAULT_BILLING_CONFIG: SystemBillingConfig = {
  pixKey: '',
  pixKeyType: 'cnpj',
  beneficiaryName: '',
  bankName: '',
  defaultTrialDays: 14,
  whatsappSupportNumber: '5511999999999',
  customMessageTemplate:
    'Olá {nome} ({empresa}), tudo bem? Sua assinatura do GoField Pro no valor de R$ {valor} vence em {vencimento}. Segue nossa Chave Pix ({chave_tipo}) para renovação: {chave_pix} ({titular}). Qualquer dúvida estamos à disposição!',
  plans: DEFAULT_PLANS,
};

export const AdminPanel: React.FC = () => {
  const { profile } = useAuth();
  const { notifySuccess, notifyError, notifyInfo, showConfirm } = useApp();


  // Navigation subtabs inside Admin
  const [adminTab, setAdminTab] = useState<'users' | 'subscriptions' | 'plans' | 'billing_settings'>('users');

  // Users State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'active' | 'blocked'>('all');
  const [subscriptionFilter, setSubscriptionFilter] = useState<'all' | 'active' | 'trial' | 'overdue' | 'suspended'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Billing & Plans Config State
  const [billingConfig, setBillingConfig] = useState<SystemBillingConfig>(() => {
    try {
      const saved = localStorage.getItem('gofield_billing_config');
      return saved ? JSON.parse(saved) : DEFAULT_BILLING_CONFIG;
    } catch {
      return DEFAULT_BILLING_CONFIG;
    }
  });

  const [plans, setPlans] = useState<PlanItemConfig[]>(() => {
    try {
      const saved = localStorage.getItem('gofield_custom_plans');
      return saved ? JSON.parse(saved) : DEFAULT_PLANS;
    } catch {
      return DEFAULT_PLANS;
    }
  });

  const [savingBilling, setSavingBilling] = useState(false);

  // Edit Plan Modal State
  const [editingPlan, setEditingPlan] = useState<PlanItemConfig | null>(null);
  const [planModalName, setPlanModalName] = useState('');
  const [planModalTag, setPlanModalTag] = useState('');
  const [planModalOriginalPrice, setPlanModalOriginalPrice] = useState<number>(0);
  const [planModalPrice, setPlanModalPrice] = useState<number>(0);
  const [planModalBadge, setPlanModalBadge] = useState('');
  const [planModalFeaturesText, setPlanModalFeaturesText] = useState('');
  const [savingPlanChanges, setSavingPlanChanges] = useState(false);
  const [isCreatingPlan, setIsCreatingPlan] = useState<boolean>(false);
  const [planModalActiveInShowcase, setPlanModalActiveInShowcase] = useState<boolean>(true);
  const [planModalHighlight, setPlanModalHighlight] = useState<boolean>(false);
  const [planModalPeriod, setPlanModalPeriod] = useState<string>('/mês');


  // Promo Coupons State
  const [coupons, setCoupons] = useState<PromoCoupon[]>([]);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponDiscount, setNewCouponDiscount] = useState<number>(20);
  const [newCouponMaxUses, setNewCouponMaxUses] = useState<number>(50);
  const [newCouponDays, setNewCouponDays] = useState<number>(30);
  const [savingCoupon, setSavingCoupon] = useState(false);

  // Edit Subscription Modal State
  const [editingUserSubscription, setEditingUserSubscription] = useState<UserProfile | null>(null);
  const [subModalPlan, setSubModalPlan] = useState<SubscriptionPlanType>('pro_mensal');
  const [subModalStatus, setSubModalStatus] = useState<SubscriptionStatusType>('active');
  const [subModalValue, setSubModalValue] = useState<number>(97);
  const [subModalExpiresAt, setSubModalExpiresAt] = useState<string>('');
  const [subModalNotes, setSubModalNotes] = useState<string>('');
  const [savingSubChanges, setSavingSubChanges] = useState(false);

  // Modal State for Adding/Pre-authorizing users
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserCompany, setNewUserCompany] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('surveyor');
  const [newUserStatus, setNewUserStatus] = useState<UserStatus>('active');
  const [newUserPlan, setNewUserPlan] = useState<SubscriptionPlanType>('free_trial');
  const [newUserSubValue, setNewUserSubValue] = useState<number>(97);
  const [savingUser, setSavingUser] = useState(false);

  // Helper to parse snapshot with subscription defaults
  const parseUsersSnapshot = (snapshotDocs: any[]): UserProfile[] => {
    const usersData = snapshotDocs.map((docSnap) => {
      const data = typeof docSnap.data === 'function' ? docSnap.data() : docSnap;
      const isOwner = (data.email || '').toLowerCase() === 'alexandre1604981@gmail.com';

      let defaultExpires = data.subscriptionExpiresAt;
      if (!defaultExpires) {
        const createdDate = data.createdAt ? new Date(data.createdAt) : new Date();
        const expiry = new Date(createdDate);
        expiry.setDate(expiry.getDate() + 14);
        defaultExpires = expiry.toISOString().split('T')[0];
      }

      const rawStatus = data.subscriptionStatus || (isOwner ? 'active' : 'trial');
      const planVal = typeof data.subscriptionValue === 'number' ? data.subscriptionValue : isOwner ? 0 : 97;

      return {
        uid: docSnap.id || data.uid,
        email: data.email || '',
        name: data.name || data.email?.split('@')[0] || 'Usuário',
        role: isOwner ? 'super_admin' : (data.role as UserRole) || 'surveyor',
        status: isOwner ? 'active' : (data.status as UserStatus) || 'pending',
        company: data.company || '',
        companyCnpj: data.companyCnpj || '',
        phone: data.phone || '',
        requestedRole: data.requestedRole || data.role || 'surveyor',
        avatar:
          data.avatar ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'U')}&background=0284c7&color=fff`,
        createdAt: data.createdAt || new Date().toISOString(),
        approvedAt: data.approvedAt,
        approvedBy: data.approvedBy,
        subscriptionPlan: data.subscriptionPlan || (isOwner ? 'florestal_corporativo' : 'free_trial'),
        subscriptionStatus: isOwner ? 'active' : rawStatus,
        subscriptionExpiresAt: defaultExpires,
        subscriptionValue: planVal,
        paymentMethod: data.paymentMethod || 'pix',
        billingNotes: data.billingNotes || '',
        maxUsersAllowed: data.maxUsersAllowed || 5,
        lastPaymentDate: data.lastPaymentDate,
      } as UserProfile;
    });

    usersData.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return usersData;
  };

  // Load Billing Config, Plans, and Coupons from Firestore & localStorage
  useEffect(() => {
    if (profile?.role !== 'super_admin') return;

    const loadBillingAndPlansConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, 'system_config', 'billing'));
        if (configDoc.exists()) {
          const data = configDoc.data() as SystemBillingConfig;
          setBillingConfig((prev) => ({ ...prev, ...data }));
          localStorage.setItem('gofield_billing_config', JSON.stringify(data));
          if (data.plans && Array.isArray(data.plans) && data.plans.length > 0) {
            setPlans(data.plans);
            localStorage.setItem('gofield_custom_plans', JSON.stringify(data.plans));
          }
        }
      } catch (e) {
        console.warn('Could not load billing config from Firestore, using local defaults', e);
      }
    };

    const loadCoupons = async () => {
      try {
        const couponsSnap = await getDocs(collection(db, 'coupons'));
        const couponList = couponsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PromoCoupon));
        setCoupons(couponList);
      } catch (e) {
        console.warn('Could not load coupons from Firestore', e);
      }
    };

    loadBillingAndPlansConfig();
    loadCoupons();
  }, [profile]);

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
        setLoading(false);
      },
      (error) => {
        console.error('Error with real-time users listener:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profile]);

  // Manual Sync
  const manualSync = useCallback(async () => {
    setRefreshing(true);
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const list = parseUsersSnapshot(snapshot.docs);
      setUsers(list);
      notifySuccess('Sincronização Concluída', `${list.length} usuário(s) sincronizados com o banco de dados.`);
    } catch (err: any) {
      console.error('Manual sync error:', err);
      notifyError('Erro de Sincronização', 'Não foi possível carregar a lista de usuários.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [notifySuccess, notifyError]);

  // Save Billing Configuration

  const [showAsaasKey, setShowAsaasKey] = useState<boolean>(false);
  const [isTestingAsaas, setIsTestingAsaas] = useState<boolean>(false);
  const [asaasTestStatus, setAsaasTestStatus] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestAsaasConnection = async () => {
    setIsTestingAsaas(true);
    setAsaasTestStatus(null);

    try {
      const result = await testAsaasConnection(billingConfig);
      setAsaasTestStatus(result);
      if (result.success) {
        notifySuccess('Asaas Conectado e Salvo!', `${result.message} A chave de API foi salva com sucesso no sistema.`);
        const newConfig = { ...billingConfig, plans };
        localStorage.setItem('gofield_billing_config', JSON.stringify(newConfig));
        try {
          await setDoc(doc(db, 'system_config', 'billing'), newConfig, { merge: true });
        } catch (e) {
          console.warn('Firestore auto-save notice:', e);
        }
      } else {
        notifyError('Falha no Asaas', result.message);
      }
    } catch (e: any) {
      setAsaasTestStatus({
        success: false,
        message: `Erro de conexão: ${e.message || 'Falha ao conectar com o Asaas.'}`,
      });
      notifyError('Erro de Conexão', 'Não foi possível comunicar com o Asaas.');
    } finally {
      setIsTestingAsaas(false);
    }
  };

  const handleSaveBillingConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBilling(true);
    try {
      const newConfig = { ...billingConfig, plans };
      localStorage.setItem('gofield_billing_config', JSON.stringify(newConfig));
      localStorage.setItem('gofield_custom_plans', JSON.stringify(plans));

      try {
        await setDoc(doc(db, 'system_config', 'billing'), newConfig, { merge: true });
      } catch (cloudErr) {
        console.warn('Firestore write notice (saved locally):', cloudErr);
      }

      notifySuccess('Configurações Salvas!', 'Os dados de cobrança Pix e mensagens foram atualizados.');
    } catch (err: any) {
      console.error('Error saving billing config:', err);
      notifyError('Erro ao Salvar', 'Não foi possível atualizar as configurações de cobrança.');
    } finally {
      setSavingBilling(false);
    }
  };


  const handleTogglePlanShowcase = async (planId: string) => {
    const updatedPlans = plans.map((p) => {
      if (p.id === planId) {
        const nextState = p.activeInShowcase === false ? true : false;
        return { ...p, activeInShowcase: nextState };
      }
      return p;
    });

    setPlans(updatedPlans);
    localStorage.setItem('gofield_custom_plans', JSON.stringify(updatedPlans));
    const updatedConfig = { ...billingConfig, plans: updatedPlans };
    setBillingConfig(updatedConfig);
    localStorage.setItem('gofield_billing_config', JSON.stringify(updatedConfig));

    try {
      await setDoc(doc(db, 'system_config', 'billing'), updatedConfig, { merge: true });
    } catch (err) {
      console.warn('Cloud write notice:', err);
    }

    const plan = updatedPlans.find((p) => p.id === planId);
    if (plan?.activeInShowcase !== false) {
      notifySuccess('Plano Ativado na Vitrine!', `O plano "${plan?.name}" agora está visível para todos os usuários.`);
    } else {
      notifyInfo('Plano Oculto da Vitrine', `O plano "${plan?.name}" foi ocultado da vitrine pública.`);
    }
  };

  const handleToggleHighlight = async (planId: string) => {
    const updatedPlans = plans.map((p) => ({
      ...p,
      highlight: p.id === planId ? !p.highlight : false,
    }));

    setPlans(updatedPlans);
    localStorage.setItem('gofield_custom_plans', JSON.stringify(updatedPlans));
    const updatedConfig = { ...billingConfig, plans: updatedPlans };
    setBillingConfig(updatedConfig);
    localStorage.setItem('gofield_billing_config', JSON.stringify(updatedConfig));

    try {
      await setDoc(doc(db, 'system_config', 'billing'), updatedConfig, { merge: true });
    } catch (err) {}
  };

  const handleDeletePlan = (planId: string) => {
    showConfirm(
      'Excluir Plano',
      'Tem certeza de que deseja remover este plano da lista?',
      async () => {
        const updatedPlans = plans.filter((p) => p.id !== planId);
        setPlans(updatedPlans);
        localStorage.setItem('gofield_custom_plans', JSON.stringify(updatedPlans));
        const updatedConfig = { ...billingConfig, plans: updatedPlans };
        setBillingConfig(updatedConfig);
        localStorage.setItem('gofield_billing_config', JSON.stringify(updatedConfig));

        try {
          await setDoc(doc(db, 'system_config', 'billing'), updatedConfig, { merge: true });
        } catch (err) {}
        notifySuccess('Plano Removido', 'O plano foi excluído com sucesso.');
      }
    );
  };

  const handleOpenCreatePlan = () => {
    setIsCreatingPlan(true);
    setEditingPlan({
      id: `plan_${Date.now()}`,
      name: '',
      tag: 'Novo Plano',
      originalPrice: 97.99,
      price: 44.99,
      discountBadge: '54% OFF',
      billingPeriod: '/mês',
      features: ['Mapas PDF Ilimitados', 'Medição de Madeira (m³)', 'GPS e Apontamentos'],
      highlight: false,
      activeInShowcase: true,
    });
    setPlanModalName('');
    setPlanModalTag('Novo');
    setPlanModalOriginalPrice(97.99);
    setPlanModalPrice(44.99);
    setPlanModalBadge('54% OFF • LANÇAMENTO');
    setPlanModalPeriod('/mês');
    setPlanModalActiveInShowcase(true);
    setPlanModalHighlight(false);
    setPlanModalFeaturesText('Mapas PDF Ilimitados\nMedição de Madeira (m³)\nRelatórios com Fotos\nGPS em Tempo Real');
  };

  // Save Plan Changes (Resilient to Firestore / Offline)
  const handleSavePlanChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    setSavingPlanChanges(true);
    try {
      const updatedFeatures = planModalFeaturesText
        .split('\n')
        .map((f) => f.replace(/^[-*•]\s*/, '').trim())
        .filter((f) => f.length > 0);

      const cleanOrigPrice = Number(planModalOriginalPrice) || 0;
      const cleanPrice = Number(planModalPrice) || 0;

      const planExists = plans.some((p) => p.id === editingPlan.id);
      let updatedPlans: PlanItemConfig[];

      if (planExists) {
        updatedPlans = plans.map((p) => {
          if (p.id === editingPlan.id) {
            return {
              ...p,
              name: planModalName.trim() || p.name,
              tag: planModalTag.trim() || p.tag,
              originalPrice: cleanOrigPrice,
              price: cleanPrice,
              discountBadge: planModalBadge.trim(),
              billingPeriod: planModalPeriod || p.billingPeriod || '/mês',
              highlight: planModalHighlight,
              activeInShowcase: planModalActiveInShowcase,
              features: updatedFeatures.length > 0 ? updatedFeatures : p.features,
            };
          }
          return p;
        });
      } else {
        const newPlanItem: PlanItemConfig = {
          id: editingPlan.id,
          name: planModalName.trim() || 'Novo Plano',
          tag: planModalTag.trim() || 'Profissional',
          originalPrice: cleanOrigPrice,
          price: cleanPrice,
          discountBadge: planModalBadge.trim(),
          billingPeriod: planModalPeriod || '/mês',
          highlight: planModalHighlight,
          activeInShowcase: planModalActiveInShowcase,
          features: updatedFeatures.length > 0 ? updatedFeatures : ['Mapas PDF Ilimitados', 'Medição de Madeira (m³)', 'GPS e Apontamentos'],
        };
        updatedPlans = [...plans, newPlanItem];
      }

      // 1. Update State immediately
      setPlans(updatedPlans);

      // 2. Persist to localStorage immediately
      localStorage.setItem('gofield_custom_plans', JSON.stringify(updatedPlans));
      const updatedConfig = { ...billingConfig, plans: updatedPlans };
      setBillingConfig(updatedConfig);
      localStorage.setItem('gofield_billing_config', JSON.stringify(updatedConfig));

      // 3. Persist to Firestore asynchronously
      try {
        await setDoc(doc(db, 'system_config', 'billing'), updatedConfig, { merge: true });
      } catch (cloudErr) {
        console.warn('Saved plans locally (cloud notice):', cloudErr);
      }

      notifySuccess('Plano Salvo com Sucesso!', `O plano "${planModalName}" foi salvo.`);
      setEditingPlan(null);
    } catch (err: any) {
      console.error('Error saving plan changes:', err);
      notifyError('Erro ao Salvar Plano', err?.message || 'Ocorreu um erro ao salvar as alterações do plano.');
    } finally {
      setSavingPlanChanges(false);
    }
  };

  // Create Promo Coupon
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCouponCode.trim()) return;
    setSavingCoupon(true);
    try {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + (newCouponDays || 30));
      const cleanCode = newCouponCode.trim().toUpperCase().replace(/\s+/g, '');

      const newCouponData: PromoCoupon = {
        id: `coupon_${cleanCode}`,
        code: cleanCode,
        discountPercent: Number(newCouponDiscount) || 10,
        validUntil: expiry.toISOString().split('T')[0],
        maxUses: Number(newCouponMaxUses) || 50,
        usedCount: 0,
        active: true,
        notes: `Criado em ${new Date().toLocaleDateString('pt-BR')}`,
      };

      await setDoc(doc(db, 'coupons', newCouponData.id), newCouponData);
      setCoupons((prev) => [newCouponData, ...prev.filter((c) => c.id !== newCouponData.id)]);
      notifySuccess('Cupom Criado com Sucesso!', `O código ${cleanCode} está ativo com ${newCouponDiscount}% OFF.`);
      setIsCouponModalOpen(false);
      setNewCouponCode('');
    } catch (err: any) {
      console.error('Error creating coupon:', err);
      notifyError('Erro ao Criar Cupom', 'Não foi possível salvar o cupom no banco.');
    } finally {
      setSavingCoupon(false);
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    try {
      await deleteDoc(doc(db, 'coupons', couponId));
      setCoupons((prev) => prev.filter((c) => c.id !== couponId));
      notifySuccess('Cupom Removido', 'O cupom foi excluído com sucesso.');
    } catch (err) {
      notifyError('Erro', 'Não foi possível excluir o cupom.');
    }
  };

  // 1-Click WhatsApp Billing
  const handleSendWhatsAppBilling = (targetUser: UserProfile) => {
    if (!targetUser.phone) {
      notifyError('WhatsApp Indisponível', `O cliente ${targetUser.name} não possui telefone/WhatsApp cadastrado.`);
      return;
    }

    const cleanPhone = targetUser.phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    const formattedExpiry = targetUser.subscriptionExpiresAt
      ? new Date(targetUser.subscriptionExpiresAt).toLocaleDateString('pt-BR')
      : 'hoje';

    const message = billingConfig.customMessageTemplate
      .replace('{nome}', targetUser.name || 'Cliente')
      .replace('{empresa}', targetUser.company || 'sua empresa')
      .replace('{valor}', (targetUser.subscriptionValue || 97).toFixed(2))
      .replace('{vencimento}', formattedExpiry)
      .replace('{chave_pix}', billingConfig.pixKey)
      .replace('{chave_tipo}', billingConfig.pixKeyType.toUpperCase())
      .replace('{titular}', billingConfig.beneficiaryName);

    const whatsappUrl = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // 1-Click +7 Days Extension (Cortesia)
  const handleExtend7Days = async (targetUser: UserProfile) => {
    try {
      const currentExpiry = targetUser.subscriptionExpiresAt ? new Date(targetUser.subscriptionExpiresAt) : new Date();
      const baseDate = currentExpiry.getTime() < Date.now() ? new Date() : currentExpiry;
      baseDate.setDate(baseDate.getDate() + 7);
      const newExpiryStr = baseDate.toISOString().split('T')[0];

      const userRef = doc(db, 'users', targetUser.uid);
      await updateDoc(userRef, {
        subscriptionExpiresAt: newExpiryStr,
        subscriptionStatus: 'active',
      });

      notifySuccess(
        '+7 Dias Concedidos!',
        `A assinatura de ${targetUser.name} foi prorrogada até ${baseDate.toLocaleDateString('pt-BR')}.`
      );
    } catch (err) {
      console.error('Error extending days:', err);
      notifyError('Erro ao Prorrogar', 'Não foi possível atualizar a data de vencimento.');
    }
  };

  // 1-Click Toggle Suspension
  const handleToggleSuspension = async (targetUser: UserProfile) => {
    const isCurrentlySuspended = targetUser.subscriptionStatus === 'suspended' || targetUser.status === 'blocked';
    const newSubStatus: SubscriptionStatusType = isCurrentlySuspended ? 'active' : 'suspended';
    const newStatus: UserStatus = isCurrentlySuspended ? 'active' : 'blocked';

    try {
      const userRef = doc(db, 'users', targetUser.uid);
      await updateDoc(userRef, {
        subscriptionStatus: newSubStatus,
        status: newStatus,
      });

      notifySuccess(
        isCurrentlySuspended ? 'Acesso Reativado!' : 'Acesso Suspenso!',
        `${targetUser.name} agora está com status ${isCurrentlySuspended ? 'Ativo' : 'Suspenso'}.`
      );
    } catch (err) {
      console.error('Error toggling suspension:', err);
      notifyError('Erro', 'Não foi possível alterar o status de acesso.');
    }
  };

  // Save Full Subscription Modal
  const handleSaveSubscriptionChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserSubscription) return;

    setSavingSubChanges(true);
    try {
      const subVal = Number(subModalValue) || 0;
      const updateData = {
        subscriptionPlan: subModalPlan,
        subscriptionStatus: subModalStatus,
        subscriptionValue: subVal,
        subscriptionExpiresAt: subModalExpiresAt,
        billingNotes: subModalNotes.trim(),
        status: subModalStatus === 'suspended' ? ('blocked' as UserStatus) : ('active' as UserStatus),
      };

      // 1. Update local users state immediately
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === editingUserSubscription.uid ? { ...u, ...updateData } : u
        )
      );

      // 2. Persist to Firestore with setDoc merge
      try {
        const userRef = doc(db, 'users', editingUserSubscription.uid);
        await setDoc(userRef, updateData, { merge: true });
      } catch (cloudErr) {
        console.warn('Saved subscription locally (cloud notice):', cloudErr);
      }

      notifySuccess('Assinatura Atualizada!', `Os dados comerciais de ${editingUserSubscription.name} foram salvos com sucesso.`);
      setEditingUserSubscription(null);
    } catch (err: any) {
      console.error('Error saving subscription changes:', err);
      notifyError('Erro ao Salvar', err?.message || 'Não foi possível salvar as alterações da assinatura.');
    } finally {
      setSavingSubChanges(false);
    }
  };

  // Create Or Authorize User
  const handleCreateOrAuthorizeUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim()) {
      notifyError('Campo Obrigatório', 'Por favor, informe o e-mail do colaborador.');
      return;
    }
    setSavingUser(true);
    try {
      const emailClean = newUserEmail.trim().toLowerCase();
      const existingUser = users.find((u) => u.email.toLowerCase() === emailClean);
      const targetUid = existingUser ? existingUser.uid : `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const userRef = doc(db, 'users', targetUid);

      const expiry = new Date();
      expiry.setDate(expiry.getDate() + (newUserPlan === 'free_trial' ? billingConfig.defaultTrialDays : 30));

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
        approvedBy: newUserStatus === 'active' ? profile?.name || 'Administrador' : undefined,
        subscriptionPlan: newUserPlan,
        subscriptionStatus: newUserPlan === 'free_trial' ? 'trial' : 'active',
        subscriptionValue: Number(newUserSubValue) || 97,
        subscriptionExpiresAt: expiry.toISOString().split('T')[0],
      };

      await setDoc(userRef, newUserData, { merge: true });
      notifySuccess(
        newUserStatus === 'active' ? 'Usuário Liberado com Sucesso!' : 'Solicitação Registrada!',
        `${newUserData.name} (${newUserData.email}) foi salvo com plano ${newUserPlan}.`
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
      console.error('Error creating user:', err);
      notifyError('Erro ao Salvar', 'Não foi possível registrar o usuário no banco de dados.');
    } finally {
      setSavingUser(false);
    }
  };

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
      notifySuccess('Acesso Liberado!', `${userToApprove.name} agora tem acesso ao GoField Pro.`);
    } catch (error) {
      console.error('Error approving user:', error);
      notifyError('Falha na Liberação', 'Não foi possível liberar o acesso do usuário.');
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
          await updateDoc(userRef, { status: 'blocked', subscriptionStatus: 'suspended' });
          notifySuccess('Usuário Bloqueado', `O acesso de ${userToBlock.name} foi bloqueado.`);
        } catch (error) {
          console.error('Error blocking user:', error);
          notifyError('Erro ao bloquear', 'Não foi possível alterar o status do usuário.');
        }
      },
    });
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
          notifySuccess('Cadastro Removido', `O registro de ${userToDelete.name} foi apagado.`);
        } catch (error) {
          console.error('Error deleting user:', error);
          notifyError('Erro ao excluir', 'Não foi possível remover o registro do usuário.');
        }
      },
    });
  };

  if (profile?.role !== 'super_admin') {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl max-w-md text-center shadow-2xl">
          <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Acesso Negado</h2>
          <p className="text-slate-400 text-xs sm:text-sm">
            Você não possui permissões de Administrador para acessar o painel comercial e de controle.
          </p>
        </div>
      </div>
    );
  }

  // Financial Calculations
  const activePayingUsers = users.filter(
    (u) => (u.subscriptionStatus === 'active' || u.status === 'active') && u.email !== 'alexandre1604981@gmail.com'
  );
  const trialUsers = users.filter((u) => u.subscriptionStatus === 'trial' || u.subscriptionPlan === 'free_trial');

  const overdueUsers = users.filter((u) => {
    if (u.email === 'alexandre1604981@gmail.com') return false;
    if (u.subscriptionStatus === 'overdue') return true;
    if (u.subscriptionExpiresAt) {
      const expDate = new Date(u.subscriptionExpiresAt).getTime();
      return expDate < Date.now() && u.subscriptionStatus !== 'suspended';
    }
    return false;
  });

  const suspendedUsers = users.filter((u) => u.subscriptionStatus === 'suspended' || u.status === 'blocked');

  const totalMrr = users
    .filter((u) => u.subscriptionStatus === 'active' && u.email !== 'alexandre1604981@gmail.com')
    .reduce((sum, u) => sum + (u.subscriptionValue || 0), 0);

  const projectedArr = totalMrr * 12;

  // Filtered Users List
  const filteredUsers = users
    .filter((u) => {
      if (filterStatus === 'pending') return u.status === 'pending';
      if (filterStatus === 'active') return u.status === 'active';
      if (filterStatus === 'blocked') return u.status === 'blocked';
      return true;
    })
    .filter((u) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        u.name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query) ||
        u.company?.toLowerCase().includes(query) ||
        u.phone?.toLowerCase().includes(query)
      );
    });

  // Filtered Subscriptions List
  const filteredSubscriptions = users
    .filter((u) => {
      if (subscriptionFilter === 'active') return u.subscriptionStatus === 'active';
      if (subscriptionFilter === 'trial') return u.subscriptionStatus === 'trial';
      if (subscriptionFilter === 'overdue') {
        const isExp = u.subscriptionExpiresAt ? new Date(u.subscriptionExpiresAt).getTime() < Date.now() : false;
        return u.subscriptionStatus === 'overdue' || isExp;
      }
      if (subscriptionFilter === 'suspended') return u.subscriptionStatus === 'suspended' || u.status === 'blocked';
      return true;
    })
    .filter((u) => {
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
    <div className="h-full overflow-y-auto overflow-x-hidden p-2.5 sm:p-5 space-y-4 sm:space-y-5 max-w-6xl mx-auto text-slate-100 pb-32 sm:pb-24 w-full">
      {/* Header Bar with Subtabs Navigation */}
      <div className="bg-slate-900 border border-slate-800 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl shadow-2xl space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Central SuperAdmin
              </span>
              <span className="text-[11px] text-slate-400 truncate">• AM TST Gestão & Planos</span>
            </div>
            <h2 className="font-extrabold text-lg sm:text-2xl text-white tracking-tight mt-1 flex items-center gap-2 truncate">
              <UserCog className="w-5 h-5 sm:w-6 sm:h-6 text-sky-400 shrink-0" />
              <span>Painel Comercial, Planos & Equipe</span>
            </h2>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setIsAddUserModalOpen(true)}
              className="flex-1 sm:flex-initial bg-sky-600 hover:bg-sky-500 text-white px-3 sm:px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all active:scale-95 shadow-md"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Novo Cliente</span>
            </button>
            <button
              onClick={manualSync}
              disabled={refreshing}
              className="bg-slate-950 hover:bg-slate-800 border border-slate-700/80 px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold text-sky-400 transition-all active:scale-95 shadow-md shrink-0"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>

        {/* Subtabs Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 pt-2 border-t border-slate-800/80">
          <button
            onClick={() => setAdminTab('users')}
            className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all truncate ${
              adminTab === 'users'
                ? 'bg-sky-600 border-sky-500 text-white shadow-lg shadow-sky-950/50'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-950'
            }`}
          >
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">Usuários & Equipe</span>
            {users.filter((u) => u.status === 'pending').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500 text-slate-950 font-black animate-pulse">
                {users.filter((u) => u.status === 'pending').length}
              </span>
            )}
          </button>

          <button
            onClick={() => setAdminTab('subscriptions')}
            className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all truncate ${
              adminTab === 'subscriptions'
                ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-950/50'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-950'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">Assinaturas</span>
            {overdueUsers.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-red-500 text-white font-black animate-pulse">
                {overdueUsers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setAdminTab('plans')}
            className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all truncate ${
              adminTab === 'plans'
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-950/50'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-950'
            }`}
          >
            <Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">Planos & Cupons</span>
          </button>

          <button
            onClick={() => setAdminTab('billing_settings')}
            className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all truncate ${
              adminTab === 'billing_settings'
                ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-950/50'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-950'
            }`}
          >
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">Dados Pix</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 2: ASSINATURAS, RECEITA (MRR) E GESTÃO DE INADIMPLENTES               */}
      {/* ========================================================================= */}
      {adminTab === 'subscriptions' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Financial KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
                  MRR (Mensal)
                </span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-base sm:text-2xl font-black text-emerald-400 font-mono truncate">
                  R$ {totalMrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 truncate">
                  ARR: R$ {projectedArr.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}/ano
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
                  Adimplentes
                </span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-lg sm:text-2xl font-black text-white font-mono">{activePayingUsers.length}</div>
                <div className="text-[9px] sm:text-[10px] text-emerald-400 font-semibold mt-0.5 truncate">Contratos em dia</div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
                  Em Teste
                </span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Gift className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-lg sm:text-2xl font-black text-amber-400 font-mono">{trialUsers.length}</div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 truncate">Período grátis</div>
              </div>
            </div>

            <div
              className={`bg-slate-900 border rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col justify-between ${
                overdueUsers.length > 0 ? 'border-red-500/60 bg-red-950/20' : 'border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
                  Inadimplentes
                </span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-lg sm:text-2xl font-black text-red-400 font-mono">{overdueUsers.length}</div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 truncate">
                  {overdueUsers.length > 0 ? 'Cobrança pendente' : 'Nenhum atraso'}
                </div>
              </div>
            </div>
          </div>

          {/* Subscriptions Filter Bar & Search */}
          <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shadow-lg">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 sm:pb-0 text-xs no-scrollbar">
              {(
                [
                  { id: 'all', label: 'Todos', count: users.length },
                  { id: 'active', label: 'Em Dia', count: activePayingUsers.length },
                  { id: 'trial', label: 'Trial', count: trialUsers.length },
                  { id: 'overdue', label: 'Inadimplentes', count: overdueUsers.length },
                  { id: 'suspended', label: 'Suspensos', count: suspendedUsers.length },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSubscriptionFilter(f.id)}
                  className={`px-2.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1 text-[11px] shrink-0 ${
                    subscriptionFilter === f.id
                      ? f.id === 'overdue'
                        ? 'bg-red-600 text-white'
                        : 'bg-emerald-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className="text-[10px] opacity-75 font-mono">({f.count})</span>
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-60 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar cliente, empresa..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Subscriptions Client Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredSubscriptions.map((subUser) => {
              const isOverdue =
                subUser.subscriptionStatus === 'overdue' ||
                (subUser.subscriptionExpiresAt && new Date(subUser.subscriptionExpiresAt).getTime() < Date.now());

              const isOwner = subUser.email === 'alexandre1604981@gmail.com';

              const expiryDate = subUser.subscriptionExpiresAt ? new Date(subUser.subscriptionExpiresAt) : null;
              const diffDays = expiryDate
                ? Math.round((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : 0;

              return (
                <div
                  key={subUser.uid}
                  className={`bg-slate-900/90 border rounded-2xl p-3.5 sm:p-4 shadow-xl flex flex-col justify-between gap-3 transition-all ${
                    isOverdue && !isOwner
                      ? 'border-red-500/60 bg-gradient-to-br from-red-950/20 to-slate-900'
                      : subUser.subscriptionStatus === 'suspended'
                      ? 'border-slate-800 opacity-60'
                      : 'border-slate-800 hover:border-emerald-500/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={subUser.avatar}
                        alt={subUser.name}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover border border-slate-700 bg-slate-950 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-extrabold text-white text-xs sm:text-sm leading-tight truncate">
                            {subUser.name}
                          </h4>
                          {isOwner && (
                            <span className="text-[8px] uppercase font-black px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                              Admin
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                          <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{subUser.company || 'Empresa não informada'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isOwner ? (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          Vitalício
                        </span>
                      ) : isOverdue ? (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse flex items-center gap-1">
                          <AlertCircle className="w-2.5 h-2.5" />
                          Vencido ({Math.abs(diffDays)}d)
                        </span>
                      ) : subUser.subscriptionStatus === 'trial' ? (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          Trial ({diffDays}d)
                        </span>
                      ) : subUser.subscriptionStatus === 'suspended' ? (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          Suspenso
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                          Em Dia ({diffDays}d)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-[11px]">
                    <div className="min-w-0">
                      <span className="text-[9px] text-slate-500 font-semibold uppercase block truncate">Plano</span>
                      <span className="font-bold text-white capitalize truncate block">
                        {subUser.subscriptionPlan === 'free_trial'
                          ? 'Teste Grátis'
                          : subUser.subscriptionPlan === 'equipe_mensal'
                          ? 'Equipe'
                          : subUser.subscriptionPlan === 'florestal_corporativo'
                          ? 'Florestal'
                          : 'Profissional'}
                      </span>
                    </div>

                    <div className="text-right min-w-0">
                      <span className="text-[9px] text-slate-500 font-semibold uppercase block truncate">Valor</span>
                      <span className="font-extrabold text-emerald-400 font-mono text-xs sm:text-sm">
                        R$ {(subUser.subscriptionValue || 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="col-span-2 pt-1 border-t border-slate-900 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        Vencimento:
                      </span>
                      <span className="font-mono font-bold text-slate-200">
                        {subUser.subscriptionExpiresAt
                          ? new Date(subUser.subscriptionExpiresAt).toLocaleDateString('pt-BR')
                          : 'Sem data'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 pt-1 w-full">
                    <button
                      type="button"
                      onClick={() => handleSendWhatsAppBilling(subUser)}
                      className="w-full sm:flex-1 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 font-bold text-xs py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Cobrar no WhatsApp</span>
                    </button>

                    <div className="grid grid-cols-3 sm:flex sm:w-auto gap-1.5 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => handleExtend7Days(subUser)}
                        title="Prorrogar por +7 dias"
                        className="bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/50 text-amber-300 font-bold text-xs py-2 px-2 rounded-xl flex items-center justify-center gap-1 active:scale-95 transition-all"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>+7d</span>
                      </button>

                      {!isOwner ? (
                        <button
                          type="button"
                          onClick={() => handleToggleSuspension(subUser)}
                          title={
                            subUser.subscriptionStatus === 'suspended'
                              ? 'Reativar acesso'
                              : 'Suspender acesso'
                          }
                          className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1 ${
                            subUser.subscriptionStatus === 'suspended'
                              ? 'bg-emerald-950 border-emerald-800 text-emerald-400'
                              : 'bg-rose-950/40 border-rose-900 text-rose-300'
                          }`}
                        >
                          {subUser.subscriptionStatus === 'suspended' ? (
                            <>
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Liberar</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              <span>Bloq</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <div />
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setEditingUserSubscription(subUser);
                          setSubModalPlan(subUser.subscriptionPlan || 'pro_mensal');
                          setSubModalStatus(subUser.subscriptionStatus || 'active');
                          setSubModalValue(subUser.subscriptionValue || 97);
                          setSubModalExpiresAt(subUser.subscriptionExpiresAt || '');
                          setSubModalNotes(subUser.billingNotes || '');
                        }}
                        title="Editar plano e valores"
                        className="py-2 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 active:scale-95 transition-all flex items-center justify-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: GESTÃO DE USUÁRIOS & PERMISSÕES (USUÁRIOS & EQUIPE)                 */}
      {/* ========================================================================= */}
      {adminTab === 'users' && (
        <div className="space-y-3.5 animate-in fade-in duration-200">
          <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shadow-lg">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 sm:pb-0 text-xs no-scrollbar">
              {(
                [
                  { id: 'all', label: 'Todos', count: users.length },
                  { id: 'pending', label: 'Pendentes', count: users.filter((u) => u.status === 'pending').length },
                  { id: 'active', label: 'Liberados', count: users.filter((u) => u.status === 'active').length },
                  { id: 'blocked', label: 'Bloqueados', count: users.filter((u) => u.status === 'blocked').length },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterStatus(f.id)}
                  className={`px-2.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1 text-[11px] shrink-0 ${
                    filterStatus === f.id
                      ? f.id === 'pending'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-sky-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className="text-[10px] opacity-75 font-mono">({f.count})</span>
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-60 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar usuário, e-mail..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            {filteredUsers.map((u) => {
              const isOwner = u.email === 'alexandre1604981@gmail.com';

              return (
                <div
                  key={u.uid}
                  className={`bg-slate-900 border rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                    u.status === 'pending'
                      ? 'border-amber-500/80 bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 ring-1 ring-amber-500/50'
                      : u.status === 'blocked'
                      ? 'border-red-950/60 opacity-60'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={u.avatar}
                      alt={u.name}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl object-cover border border-slate-700 bg-slate-950 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-extrabold text-white text-xs sm:text-sm truncate max-w-[180px] sm:max-w-none">
                          {u.name}
                        </h4>
                        {isOwner && (
                          <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/40">
                            SuperAdmin
                          </span>
                        )}
                        <span
                          className={`text-[9px] uppercase font-black px-1.5 py-0.2 rounded-full border ${
                            u.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : u.status === 'pending'
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse'
                              : 'bg-red-500/20 text-red-400 border-red-500/30'
                          }`}
                        >
                          {u.status === 'active' ? 'Ativo' : u.status === 'pending' ? 'Pendente' : 'Bloqueado'}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5">
                        <span className="flex items-center gap-1 font-mono text-[10px] text-slate-300 truncate max-w-[170px] sm:max-w-none">
                          <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{u.email}</span>
                        </span>
                        {u.phone && (
                          <span className="flex items-center gap-1 text-[10px] text-slate-300 truncate">
                            <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>{u.phone}</span>
                          </span>
                        )}
                        {u.company && (
                          <span className="flex items-center gap-1 text-[10px] text-slate-300 truncate">
                            <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate">{u.company}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 shrink-0 border-t sm:border-t-0 border-slate-800/80 pt-2 sm:pt-0">
                    {u.status === 'pending' ? (
                      <button
                        onClick={() => handleApproveUser(u)}
                        className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Aprovar Acesso</span>
                      </button>
                    ) : (
                      <>
                        {!isOwner && (
                          <button
                            onClick={() => handleBlockUser(u)}
                            className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                              u.status === 'blocked'
                                ? 'bg-emerald-950 border-emerald-800 text-emerald-300'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-red-400'
                            }`}
                            title={u.status === 'blocked' ? 'Desbloquear' : 'Bloquear'}
                          >
                            {u.status === 'blocked' ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </>
                    )}

                    {!isOwner && (
                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="p-2 rounded-xl bg-slate-950 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-800 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Excluir cadastro"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PLANOS EDITÁVEIS, PREÇOS COM DESCONTO & CUPONS                     */}
      {/* ========================================================================= */}
      {adminTab === 'plans' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-900 to-indigo-950/60 p-4 sm:p-5 rounded-3xl border border-indigo-500/40 shadow-xl">
              <div>
                <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Tag className="w-4 h-4 text-indigo-400" />
                  Vitrine de Planos & Escolha de Opções do Usuário
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-300 mt-1">
                  Clique nas pílulas <b className="text-emerald-400">🟢 Visível na Vitrine</b> / <b className="text-slate-400">⚪ Oculto</b> abaixo para escolher quais planos aparecem na tela do usuário ao assinar.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingPlan({
                    id: `custom_plan_${Date.now()}`,
                    name: 'Novo Plano de Campo',
                    tag: 'Profissional',
                    originalPrice: 149.90,
                    price: 69.90,
                    billingPeriod: '/mês',
                    discountBadge: '53% OFF',
                    highlight: false,
                    activeInShowcase: true,
                    features: ['Acesso a Mapas Ilimitados', 'Medição de Pilha de Madeira', 'Offline Total'],
                  });
                  setPlanModalName('Novo Plano de Campo');
                  setPlanModalTag('Profissional');
                  setPlanModalOriginalPrice(149.90);
                  setPlanModalPrice(69.90);
                  setPlanModalBadge('53% OFF');
                  setPlanModalFeaturesText('Acesso a Mapas Ilimitados\nMedição de Pilha de Madeira\nOffline Total');
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-4 py-2.5 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-950/60 active:scale-95 transition-all shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Adicionar Novo Plano</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {plans.map((plan) => {
                const discountAmount = plan.originalPrice > plan.price ? plan.originalPrice - plan.price : 0;
                const isVisible = plan.activeInShowcase !== false;

                return (
                  <div
                    key={plan.id}
                    className={`bg-slate-900 border rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col justify-between space-y-4 relative transition-all ${
                      isVisible
                        ? plan.highlight
                          ? 'border-amber-500/80 ring-2 ring-amber-500/40 bg-gradient-to-b from-amber-950/20 to-slate-900'
                          : 'border-emerald-500/60 ring-1 ring-emerald-500/30'
                        : 'border-slate-800 opacity-60 bg-slate-950/50'
                    }`}
                  >
                    <div>
                      {/* Top Action Bar with 1-Click Visibility Switch */}
                      <div className="flex items-center justify-between gap-1.5 flex-wrap mb-3">
                        <button
                          type="button"
                          onClick={() => handleTogglePlanShowcase(plan.id)}
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer ${
                            isVisible
                              ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-400 font-extrabold hover:bg-emerald-400'
                              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                          }`}
                          title="Clique para ativar ou desativar este plano na tela do cliente"
                        >
                          {isVisible ? '🟢 Visível na Vitrine' : '⚪ Oculto na Vitrine'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleHighlight(plan.id)}
                          className={`px-2.5 py-1 rounded-xl border text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer ${
                            plan.highlight
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-black'
                              : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                          }`}
                          title="Destacar este plano como o mais popular"
                        >
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>{plan.highlight ? '★ Em Destaque' : 'Destacar'}</span>
                        </button>
                      </div>

                      <h4 className="text-base sm:text-lg font-black text-white">{plan.name}</h4>

                      <div className="mt-2.5 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                        {plan.originalPrice > plan.price && (
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span>De:</span>
                            <span className="line-through font-mono font-bold text-slate-500">
                              R$ {plan.originalPrice.toFixed(2)}
                            </span>
                            <span className="text-emerald-400 text-[10px] font-bold">
                              (-R$ {discountAmount.toFixed(0)})
                            </span>
                          </div>
                        )}
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-[11px] font-bold text-slate-300">Por:</span>
                          <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                            R$ {plan.price.toFixed(2)}
                          </span>
                          <span className="text-xs text-slate-400">{plan.billingPeriod}</span>
                        </div>
                      </div>

                      <div className="mt-3.5 space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Serviços & Recursos Incluídos:
                        </span>
                        <ul className="space-y-1.5 text-xs text-slate-300">
                          {plan.features.map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 text-[11px] leading-tight">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingPlan(false);
                          setEditingPlan(plan);
                          setPlanModalName(plan.name);
                          setPlanModalTag(plan.tag);
                          setPlanModalOriginalPrice(plan.originalPrice);
                          setPlanModalPrice(plan.price);
                          setPlanModalBadge(plan.discountBadge || '');
                          setPlanModalPeriod(plan.billingPeriod || '/mês');
                          setPlanModalActiveInShowcase(plan.activeInShowcase !== false);
                          setPlanModalHighlight(plan.highlight || false);
                          setPlanModalFeaturesText(plan.features.join('\n'));
                        }}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 border border-slate-700 shadow cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                        <span>Editar Valores & Serviços</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800 pb-3">
              <div>
                <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-amber-400" />
                  Cupons Promocionais & Descontos Regionais
                </h4>
                <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5">
                  Crie cupons para que os clientes apliquem descontos adicionais na tela de adesão.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsCouponModalOpen(true)}
                className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-black px-3 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Cupom</span>
              </button>
            </div>

            {coupons.length === 0 ? (
              <div className="p-5 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                Nenhum cupom ativo. Clique acima para criar um cupom de lançamento.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {coupons.map((coupon) => (
                  <div
                    key={coupon.id}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-mono font-black text-amber-400 text-xs tracking-wider">{coupon.code}</span>
                      <div className="text-[10px] text-slate-300 font-semibold mt-0.5">
                        {coupon.discountPercent}% de Desconto
                      </div>
                      <div className="text-[9px] text-slate-500">Validade: {coupon.validUntil}</div>
                    </div>
                    <button
                      onClick={() => handleDeleteCoupon(coupon.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-900 transition-colors"
                      title="Excluir cupom"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CONFIGURAÇÕES DE COBRANÇA (PIX & WHATSAPP)                         */}
      {/* ========================================================================= */}
      {adminTab === 'billing_settings' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* 1. ASAAS GATEWAY CARD */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
                  Gateway Asaas (PIX com Liberação Automática)
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                  Gere cobranças PIX dinâmicas com QR Code e libere os clientes instantaneamente após o pagamento.
                </p>
              </div>
              <a
                href="https://www.asaas.com"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] sm:text-xs text-indigo-400 hover:text-indigo-300 font-bold underline flex items-center gap-1"
              >
                Abrir Painel Asaas
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Ambiente Asaas *
                </label>
                <select
                  value={billingConfig.asaasEnvironment || 'production'}
                  onChange={(e) => setBillingConfig((p) => ({ ...p, asaasEnvironment: e.target.value as any }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                >
                  <option value="production">🟢 Produção (api.asaas.com)</option>
                  <option value="sandbox">🟡 Sandbox / Testes (sandbox.asaas.com)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Chave de API do Asaas (API Key) *
                </label>
                <div className="relative">
                  <input
                    type={showAsaasKey ? 'text' : 'password'}
                    value={billingConfig.asaasApiKey || ''}
                    onChange={(e) => setBillingConfig((p) => ({ ...p, asaasApiKey: e.target.value }))}
                    placeholder="$aact_YTU5YTE0M2M6N2I4MT..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3 pr-10 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAsaasKey(!showAsaasKey)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showAsaasKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[9px] text-slate-500 mt-1">
                  No Asaas vá em: <b>Configurações &gt; Integrações &gt; Gerar Chave de API</b>.
                </p>
              </div>
            </div>

            {/* Test Connection Button, Save Button & Status */}
            <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleTestAsaasConnection}
                  disabled={isTestingAsaas}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingAsaas ? 'animate-spin' : ''}`} />
                  <span>{isTestingAsaas ? 'Testando Conexão...' : 'Testar Conexão com o Asaas'}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSaveBillingConfig(e as any)}
                  disabled={savingBilling}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow transition-all active:scale-95 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Salvar Chave Asaas</span>
                </button>
              </div>

              {asaasTestStatus && (
                <div className={`text-xs px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
                  asaasTestStatus.success
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                    : 'bg-rose-950/60 border-rose-500 text-rose-300'
                }`}>
                  {asaasTestStatus.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{asaasTestStatus.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* 2. MANUAL PIX & WHATSAPP CONFIGURATION CARD */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                <QrCode className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                Chave Pix Direta & Suporte WhatsApp (Contingência / Opcional)
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-1">
                Opcional: utilizado apenas para transferências manuais ou quando o cliente preferir falar diretamente no WhatsApp.
              </p>
            </div>

          <form onSubmit={handleSaveBillingConfig} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Tipo da Chave Pix (Opcional)
                </label>
                <select
                  value={billingConfig.pixKeyType}
                  onChange={(e) => setBillingConfig((p) => ({ ...p, pixKeyType: e.target.value as any }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="phone">Celular</option>
                  <option value="random">Chave Aleatória (EVP)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Sua Chave Pix (Opcional)
                </label>
                <input
                  type="text"
                  value={billingConfig.pixKey || ''}
                  onChange={(e) => setBillingConfig((p) => ({ ...p, pixKey: e.target.value }))}
                  placeholder="Ex: seuemail@dominio.com ou CNPJ ou Telefone"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Nome do Titular / Razão Social (Opcional)
                </label>
                <input
                  type="text"
                  value={billingConfig.beneficiaryName || ''}
                  onChange={(e) => setBillingConfig((p) => ({ ...p, beneficiaryName: e.target.value }))}
                  placeholder="Ex: Nome Completo ou Razão Social"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Banco de Recebimento
                </label>
                <input
                  type="text"
                  value={billingConfig.bankName}
                  onChange={(e) => setBillingConfig((p) => ({ ...p, bankName: e.target.value }))}
                  placeholder="Ex: Banco Inter PJ / Nubank PJ"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase mb-1">
                Modelo da Mensagem de Cobrança WhatsApp
              </label>
              <textarea
                rows={3}
                value={billingConfig.customMessageTemplate}
                onChange={(e) => setBillingConfig((p) => ({ ...p, customMessageTemplate: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-sans leading-relaxed"
              />
              <p className="text-[9px] text-slate-500 mt-1">
                Tags automáticas: <b className="text-slate-400">&#123;nome&#125;</b>,{' '}
                <b className="text-slate-400">&#123;empresa&#125;</b>, <b className="text-slate-400">&#123;valor&#125;</b>,{' '}
                <b className="text-slate-400">&#123;vencimento&#125;</b>, <b className="text-slate-400">&#123;chave_pix&#125;</b>.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingBilling}
                className="w-full sm:w-auto bg-amber-600 hover:bg-amber-500 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {savingBilling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Salvar Configurações de Cobrança</span>
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 0: EDIT PLAN VALUES, DISCOUNTS & SERVICES MODAL                     */}
      {/* ========================================================================= */}
      {editingPlan && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg max-h-[90dvh] flex flex-col p-4 sm:p-6 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="min-w-0">
                <h3 className="font-bold text-white text-sm sm:text-base truncate">Editar Valores & Serviços do Plano</h3>
                <p className="text-[11px] text-slate-400 truncate">Configure descontos, preços cheios e benefícios</p>
              </div>
              <button
                onClick={() => setEditingPlan(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlanChanges} className="space-y-3 text-xs overflow-y-auto py-3 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1">Nome do Plano *</label>
                  <input
                    type="text"
                    required
                    value={planModalName}
                    onChange={(e) => setPlanModalName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1">Rótulo / Tag</label>
                  <input
                    type="text"
                    value={planModalTag}
                    onChange={(e) => setPlanModalTag(e.target.value)}
                    placeholder="Ex: Mais Popular ou Individual"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1">
                    Preço Inteiro Cheio (Tabela) R$
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={planModalOriginalPrice}
                    onChange={(e) => setPlanModalOriginalPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                  <p className="text-[9px] text-slate-500 mt-0.5">Aparece riscado para destacar o desconto.</p>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1">
                    Preço Promocional / Cobrado R$ *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={planModalPrice}
                    onChange={(e) => setPlanModalPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold"
                  />
                  <p className="text-[9px] text-slate-500 mt-0.5">Valor final mensal a ser cobrado.</p>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1">
                    Selo de Desconto em Destaque
                  </label>
                  <input
                    type="text"
                    value={planModalBadge}
                    onChange={(e) => setPlanModalBadge(e.target.value)}
                    placeholder="Ex: 35% OFF ou Economize R$ 101/mês"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold"
                  />
                </div>

                <div className="sm:col-span-2 flex flex-col sm:flex-row gap-2 pt-1">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={planModalActiveInShowcase}
                      onChange={(e) => setPlanModalActiveInShowcase(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
                    />
                    <div className="text-left">
                      <span className="text-[11px] font-black text-emerald-400 block">🟢 Visível na Vitrine</span>
                      <span className="text-[9px] text-slate-400">Exibir este plano para os usuários</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={planModalHighlight}
                      onChange={(e) => setPlanModalHighlight(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
                    />
                    <div className="text-left">
                      <span className="text-[11px] font-black text-amber-400 block">★ Plano em Destaque</span>
                      <span className="text-[9px] text-slate-400">Marcar como Mais Popular</span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1">
                  Serviços e Benefícios (1 por linha)
                </label>
                <textarea
                  rows={4}
                  value={planModalFeaturesText}
                  onChange={(e) => setPlanModalFeaturesText(e.target.value)}
                  placeholder="Ex:&#10;1 Operador de Campo&#10;Mapas PDF Ilimitados&#10;Medição de Pilha de Madeira"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white leading-relaxed font-sans"
                />
                <p className="text-[9px] text-slate-500 mt-0.5">
                  Cada linha escrita aqui será exibida como um item com check verde na vitrine do cliente.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPlanChanges}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg"
                >
                  {savingPlanChanges ? 'Salvando...' : 'Salvar Alterações do Plano'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: EDIT SUBSCRIPTION / PLAN DETAILS                                 */}
      {/* ========================================================================= */}
      {editingUserSubscription && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md max-h-[90dvh] flex flex-col p-4 sm:p-6 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="min-w-0">
                <h3 className="font-bold text-white text-sm sm:text-base truncate">Gerenciar Assinatura</h3>
                <p className="text-[11px] text-slate-400 truncate">
                  {editingUserSubscription.name} ({editingUserSubscription.company || 'Empresa'})
                </p>
              </div>
              <button
                onClick={() => setEditingUserSubscription(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubscriptionChanges} className="space-y-3 text-xs overflow-y-auto py-3 flex-1">
              <div>
                <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1">Plano</label>
                <select
                  value={subModalPlan}
                  onChange={(e) => setSubModalPlan(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="free_trial">Teste Grátis (Trial)</option>
                  <option value="pro_mensal">Profissional Mensal</option>
                  <option value="equipe_mensal">Plano Equipe</option>
                  <option value="florestal_corporativo">Florestal & Usinas</option>
                  <option value="personalizado">Personalizado</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1">Status</label>
                  <select
                    value={subModalStatus}
                    onChange={(e) => setSubModalStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-white"
                  >
                    <option value="active">🟢 Em Dia</option>
                    <option value="trial">🟡 Trial</option>
                    <option value="overdue">🔴 Vencido</option>
                    <option value="suspended">⚪ Suspenso</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1">Valor Mensal (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={subModalValue}
                    onChange={(e) => setSubModalValue(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1">Data de Vencimento</label>
                <input
                  type="date"
                  value={subModalExpiresAt}
                  onChange={(e) => setSubModalExpiresAt(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1">Notas Internas</label>
                <textarea
                  rows={2}
                  value={subModalNotes}
                  onChange={(e) => setSubModalNotes(e.target.value)}
                  placeholder="Ex: Contrato anual fechado com Pix todo dia 10."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingUserSubscription(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingSubChanges}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  {savingSubChanges ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD / PRE-AUTHORIZE NEW CLIENT MODAL                             */}
      {/* ========================================================================= */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg max-h-[90dvh] flex flex-col p-4 sm:p-6 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="min-w-0">
                <h3 className="font-bold text-white text-sm sm:text-base truncate">Cadastrar Novo Cliente</h3>
                <p className="text-[11px] text-slate-400 truncate">Pré-autorize o acesso ou cadastre uma nova empresa</p>
              </div>
              <button
                onClick={() => setIsAddUserModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrAuthorizeUser} className="space-y-3 text-xs overflow-y-auto py-3 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1">E-mail de Acesso *</label>
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="joao@empresa.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1">Empresa / Razão Social</label>
                  <input
                    type="text"
                    value={newUserCompany}
                    onChange={(e) => setNewUserCompany(e.target.value)}
                    placeholder="Ex: Madeireira Vale Verde"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1">WhatsApp / Telefone</label>
                  <input
                    type="tel"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1">Plano Inicial</label>
                  <select
                    value={newUserPlan}
                    onChange={(e) => {
                      const plan = e.target.value as SubscriptionPlanType;
                      setNewUserPlan(plan);
                      setNewUserSubValue(plan === 'equipe_mensal' ? 289 : plan === 'florestal_corporativo' ? 690 : 97);
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="free_trial">Teste Grátis (14 dias)</option>
                    <option value="pro_mensal">Profissional Mensal (R$ 97)</option>
                    <option value="equipe_mensal">Plano Equipe (R$ 289)</option>
                    <option value="florestal_corporativo">Florestal & Usinas (R$ 690)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1">Nível de Acesso</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="surveyor">Coletor de Campo</option>
                    <option value="field_lead">Líder de Equipe</option>
                    <option value="auditor">Auditor (Visualizador)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs"
                >
                  {savingUser ? 'Salvando...' : 'Cadastrar e Liberar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CREATE PROMO COUPON MODAL                                        */}
      {/* ========================================================================= */}
      {isCouponModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-4 sm:p-6 shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-sm sm:text-base">Criar Cupom Promocional</h3>
                <p className="text-[11px] text-slate-400">Gere códigos de desconto para clientes regionais</p>
              </div>
              <button
                onClick={() => setIsCouponModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCoupon} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1">
                  Código do Cupom *
                </label>
                <input
                  type="text"
                  required
                  value={newCouponCode}
                  onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                  placeholder="Ex: REGIAO20"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono uppercase font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1">
                    % de Desconto
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newCouponDiscount}
                    onChange={(e) => setNewCouponDiscount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold uppercase text-[10px] mb-1">
                    Validade (Dias)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newCouponDays}
                    onChange={(e) => setNewCouponDays(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCouponModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCoupon}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs"
                >
                  {savingCoupon ? 'Criando...' : 'Ativar Cupom'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
