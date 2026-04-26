import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Shield, Users, Briefcase, Wallet, FileText } from 'lucide-react';

export default function Guide() {
  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="font-display font-bold text-2xl lg:text-3xl text-foreground tracking-tight">Guide complet de l’application</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Guide pratique, concret, pour utiliser Vayase Navigator du premier jour jusqu'au suivi quotidien.
        </p>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="w-4 h-4 text-vayase-accent" />
          <h2 className="font-display font-semibold">Démarrage rapide (10 minutes)</h2>
        </div>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal ml-5">
          <li>Vérifie ton rôle dans la page Employés (Admin).</li>
          <li>Admin: crée au moins un modèle de procédure dans Procédures.</li>
          <li>Crée un prospect dans Prospects.</li>
          <li>Convertis le prospect en client.</li>
          <li>Dans Clients, vérifie que les étapes ont été générées.</li>
          <li>Dans la fiche client, crée un contrat puis des paiements.</li>
        </ol>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-vayase-accent" />
          <h2 className="font-display font-semibold">1) Rôles et accès</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>Super Admin / Admin: accès complet</Badge>
          <Badge>Comptable: Finance + paiements</Badge>
          <Badge>Agent: prospects/clients assignés + étapes</Badge>
          <Badge>Manager: suivi équipe + opération</Badge>
          <Badge>Support: suivi des dossiers</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Important: si un menu n'apparaît pas (ex: Finance), c'est normal selon le rôle.
        </p>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Briefcase className="w-4 h-4 text-vayase-accent" />
          <h2 className="font-display font-semibold">2) Créer une procédure type (Admin)</h2>
        </div>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal ml-5">
          <li>Aller dans la page Procédures.</li>
          <li>Dans "Création procédures et étapes (Admin)", créer un modèle (nom, pays, type procédure).</li>
          <li>Ajouter les étapes: nom, ordre, délai en jours, notes.</li>
          <li>Réorganiser les étapes avec Monter/Descendre.</li>
          <li>Le modèle est ensuite disponible dans Nouveau client.</li>
        </ol>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-vayase-accent" />
          <h2 className="font-display font-semibold">3) Créer un client avec étapes automatiques</h2>
        </div>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal ml-5">
          <li>Aller dans Clients puis cliquer Nouveau client.</li>
          <li>Saisir infos client + responsable.</li>
          <li>Sélectionner une procédure (modèle).</li>
          <li>Créer: les étapes sont générées automatiquement.</li>
          <li>Si besoin, dans la fiche client, allez dans Modifier puis changez la procédure pour remplacer les étapes.</li>
        </ol>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-vayase-accent" />
          <h2 className="font-display font-semibold">4) Prospects → Clients</h2>
        </div>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal ml-5">
          <li>Créer le prospect dans Prospects (source, budget, destination, notes).</li>
          <li>Cliquer Convertir (vue pipeline ou liste).</li>
          <li>Le client est créé, le prospect passe “converti”, redirection automatique vers la fiche client.</li>
        </ol>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="w-4 h-4 text-vayase-accent" />
          <h2 className="font-display font-semibold">5) Contrats et paiements</h2>
        </div>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal ml-5">
          <li>Dans la fiche client (onglet Finance), créer d'abord un contrat.</li>
          <li>Ensuite ajouter les paiements (FCFA/XOF).</li>
          <li>Mettre à jour le statut des paiements (pending/paid/overdue/cancelled).</li>
        </ol>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-vayase-accent" />
          <h2 className="font-display font-semibold">Parcours quotidien par rôle</h2>
        </div>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p><b>Agent:</b> ouvre Dashboard, traite ses prospects, convertit en clients, met à jour les étapes.</p>
          <p><b>Comptable:</b> ouvre Finance, contrôle contrats/paiements, met à jour les statuts.</p>
          <p><b>Admin:</b> gère équipes, rôles, procédures modèles, affectations clients.</p>
          <p><b>Manager/Support:</b> suit progression des dossiers et blocages dans Procédures.</p>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="w-4 h-4 text-vayase-accent" />
          <h2 className="font-display font-semibold">Bonnes pratiques</h2>
        </div>
        <ul className="text-sm text-muted-foreground space-y-2 list-disc ml-5">
          <li>Toujours assigner un responsable au prospect/client.</li>
          <li>Ajouter une note avant de valider une étape critique.</li>
          <li>Utiliser les modèles de procédure pour standardiser le travail.</li>
          <li>Vérifier les droits des utilisateurs dans Employés.</li>
        </ul>
      </Card>
    </div>
  );
}
