import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  fr: {
    translation: {
      brand: { name: 'VAYASE', tagline: 'Consulting Enterprise Management' },
      common: {
        search: 'Rechercher...',
        save: 'Enregistrer', cancel: 'Annuler', delete: 'Supprimer', edit: 'Modifier',
        create: 'Créer', add: 'Ajouter', confirm: 'Confirmer', close: 'Fermer',
        loading: 'Chargement...', noData: 'Aucune donnée', actions: 'Actions',
        status: 'Statut', date: 'Date', name: 'Nom', email: 'Email', phone: 'Téléphone',
        amount: 'Montant', currency: 'Devise', total: 'Total', back: 'Retour',
        viewAll: 'Voir tout', view: 'Voir', export: 'Exporter', filter: 'Filtrer',
        all: 'Tous', notes: 'Notes', priority: 'Priorité', dueDate: 'Échéance',
      },
      nav: {
        dashboard: 'Tableau de bord', leads: 'Prospects', clients: 'Clients',
        procedures: 'Procédures', finance: 'Finance', employees: 'Employés',
        calendar: 'Calendrier', documents: 'Documents', reports: 'Rapports', guide: 'Guide',
        settings: 'Paramètres', logout: 'Déconnexion',
      },
      auth: {
        signIn: 'Se connecter', signUp: 'Créer un compte', signOut: 'Déconnexion',
        email: 'Email', password: 'Mot de passe', fullName: 'Nom complet',
        forgotPassword: 'Mot de passe oublié ?', resetPassword: 'Réinitialiser',
        noAccount: "Pas encore de compte ?", hasAccount: 'Déjà un compte ?',
        welcomeBack: 'Bon retour', signInSubtitle: 'Accédez à votre espace VAYASE',
        signUpSubtitle: 'Rejoignez la plateforme premium VAYASE',
        signInError: 'Identifiants invalides', signUpSuccess: 'Compte créé avec succès',
        checkEmail: 'Vérifiez votre email pour confirmer votre compte',
      },
      dashboard: {
        title: 'Tableau de bord', welcome: 'Bonjour',
        totalProspects: 'Prospects', totalClients: 'Clients',
        monthlyRevenue: 'Revenus du mois', annualRevenue: 'Revenus annuels',
        pendingPayments: 'Paiements en attente', activeFiles: 'Dossiers en cours',
        approvedFiles: 'Dossiers approuvés', conversionRate: 'Taux conversion',
        revenueEvolution: 'Évolution des revenus', clientsByCountry: 'Clients par pays',
        salesPipeline: 'Pipeline commercial', recentActivity: 'Activités récentes',
        topAgents: 'Top agents du mois', vsLastMonth: 'vs mois dernier',
      },
      clients: {
        title: 'Clients', new: 'Nouveau client', searchPlaceholder: 'Rechercher un client...',
        fullName: 'Nom complet', destination: 'Destination', visa: 'Type de visa',
        program: 'Programme', nationality: 'Nationalité', profession: 'Profession',
        status: { vip: 'VIP', standard: 'Standard', late_payment: 'Retard paiement', priority: 'Prioritaire' },
        details: 'Détails du client', personalInfo: 'Informations personnelles',
        immigrationProject: 'Projet immigration', procedure: 'Procédure',
        finance: 'Finance', documents: 'Documents',
      },
      leads: {
        title: 'Prospects', new: 'Nouveau prospect', pipeline: 'Pipeline',
        source: 'Source', interestLevel: 'Niveau d\'intérêt', budget: 'Budget',
        status: { new: 'Nouveau', contacted: 'Contacté', meeting_scheduled: 'RDV pris', converted: 'Converti', lost: 'Perdu' },
      },
      procedures: {
        title: 'Procédures', timeline: 'Timeline', addStep: 'Ajouter une étape',
        stepName: 'Nom de l\'étape', responsible: 'Responsable',
        status: { todo: 'À faire', in_progress: 'En cours', validated: 'Validé', blocked: 'Bloqué', completed: 'Terminé' },
      },
      finance: {
        title: 'Finance', contracts: 'Contrats', payments: 'Paiements',
        totalRevenue: 'Revenus totaux', paidAmount: 'Montant payé',
        pendingAmount: 'En attente', overdueAmount: 'En retard',
        contractNumber: 'N° contrat', paymentMethod: 'Mode de paiement',
        reference: 'Référence',
        paymentStatus: { pending: 'En attente', paid: 'Payé', overdue: 'En retard', cancelled: 'Annulé' },
      },
      roles: {
        super_admin: 'Super Admin', admin: 'Administrateur', agent: 'Agent Immigration',
        comptable: 'Comptable', manager: 'Manager', support: 'Support',
      },
    }
  },
  en: {
    translation: {
      brand: { name: 'VAYASE', tagline: 'Consulting Enterprise Management' },
      common: {
        search: 'Search...',
        save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit',
        create: 'Create', add: 'Add', confirm: 'Confirm', close: 'Close',
        loading: 'Loading...', noData: 'No data', actions: 'Actions',
        status: 'Status', date: 'Date', name: 'Name', email: 'Email', phone: 'Phone',
        amount: 'Amount', currency: 'Currency', total: 'Total', back: 'Back',
        viewAll: 'View all', view: 'View', export: 'Export', filter: 'Filter',
        all: 'All', notes: 'Notes', priority: 'Priority', dueDate: 'Due date',
      },
      nav: {
        dashboard: 'Dashboard', leads: 'Leads', clients: 'Clients',
        procedures: 'Procedures', finance: 'Finance', employees: 'Employees',
        calendar: 'Calendar', documents: 'Documents', reports: 'Reports', guide: 'Guide',
        settings: 'Settings', logout: 'Logout',
      },
      auth: {
        signIn: 'Sign in', signUp: 'Create account', signOut: 'Sign out',
        email: 'Email', password: 'Password', fullName: 'Full name',
        forgotPassword: 'Forgot password?', resetPassword: 'Reset password',
        noAccount: "Don't have an account?", hasAccount: 'Already have an account?',
        welcomeBack: 'Welcome back', signInSubtitle: 'Access your VAYASE workspace',
        signUpSubtitle: 'Join the premium VAYASE platform',
        signInError: 'Invalid credentials', signUpSuccess: 'Account created successfully',
        checkEmail: 'Check your email to confirm your account',
      },
      dashboard: {
        title: 'Dashboard', welcome: 'Hello',
        totalProspects: 'Prospects', totalClients: 'Clients',
        monthlyRevenue: 'Monthly revenue', annualRevenue: 'Annual revenue',
        pendingPayments: 'Pending payments', activeFiles: 'Active files',
        approvedFiles: 'Approved files', conversionRate: 'Conversion rate',
        revenueEvolution: 'Revenue evolution', clientsByCountry: 'Clients by country',
        salesPipeline: 'Sales pipeline', recentActivity: 'Recent activity',
        topAgents: 'Top agents', vsLastMonth: 'vs last month',
      },
      clients: {
        title: 'Clients', new: 'New client', searchPlaceholder: 'Search a client...',
        fullName: 'Full name', destination: 'Destination', visa: 'Visa type',
        program: 'Program', nationality: 'Nationality', profession: 'Profession',
        status: { vip: 'VIP', standard: 'Standard', late_payment: 'Late payment', priority: 'Priority' },
        details: 'Client details', personalInfo: 'Personal information',
        immigrationProject: 'Immigration project', procedure: 'Procedure',
        finance: 'Finance', documents: 'Documents',
      },
      leads: {
        title: 'Leads', new: 'New lead', pipeline: 'Pipeline',
        source: 'Source', interestLevel: 'Interest level', budget: 'Budget',
        status: { new: 'New', contacted: 'Contacted', meeting_scheduled: 'Meeting set', converted: 'Converted', lost: 'Lost' },
      },
      procedures: {
        title: 'Procedures', timeline: 'Timeline', addStep: 'Add a step',
        stepName: 'Step name', responsible: 'Responsible',
        status: { todo: 'To do', in_progress: 'In progress', validated: 'Validated', blocked: 'Blocked', completed: 'Completed' },
      },
      finance: {
        title: 'Finance', contracts: 'Contracts', payments: 'Payments',
        totalRevenue: 'Total revenue', paidAmount: 'Paid amount',
        pendingAmount: 'Pending', overdueAmount: 'Overdue',
        contractNumber: 'Contract #', paymentMethod: 'Payment method',
        reference: 'Reference',
        paymentStatus: { pending: 'Pending', paid: 'Paid', overdue: 'Overdue', cancelled: 'Cancelled' },
      },
      roles: {
        super_admin: 'Super Admin', admin: 'Administrator', agent: 'Immigration Agent',
        comptable: 'Accountant', manager: 'Manager', support: 'Support',
      },
    }
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'fr',
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
  });

export default i18n;
