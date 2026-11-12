# SVI Mali — administrations maliennes

Prototype web interactif de serveur vocal interactif (SVI), conçu à partir du dossier fonctionnel du projet. L’application permet de configurer un court menu français, de simuler la navigation DTMF, de créer et suivre une demande de rappel et de consulter des indicateurs agrégés.

## Utiliser la démonstration

Ouvrir `index.html` dans un navigateur moderne, ou servir le dossier avec un serveur HTTP statique. Aucun paquet tiers n’est nécessaire pour l’application; Node.js 20 ou plus récent est uniquement requis pour les tests.

```sh
npm test
```

Les réglages, rappels et événements de simulation sont enregistrés dans le stockage local du navigateur. Les événements ne contiennent ni numéro d’appelant ni audio. Les numéros ne sont conservés que pour les demandes de rappel explicites. Les rapports et appels expirent après 30 jours; un rappel clôturé expire après 7 jours. « Effacer les données de démonstration » supprime immédiatement toutes les données locales de l’application.

## Portée et limites

- Cette livraison est un **MVP web de démonstration**, et non un PBX, un serveur SIP ou une plateforme d’appels.
- Il n’y a aucun numéro téléphonique, opérateur, trunk SIP, transfert, agent, SMS, compte utilisateur ou service backend configuré.
- Les données locales ne sont pas chiffrées et ne sont pas protégées par une authentification. Ne pas saisir de données client ou personnelles réelles.
- L’enregistrement audio est désactivé et n’est pas pris en charge.
- Aucun renseignement sensible, résultat médical, identifiant ou donnée de paiement n’est demandé dans le menu. Le parcours de rappel n’accepte qu’un numéro et un motif général prédéfini.
- Le prototype ne pose aucun diagnostic et ne réalise aucun triage médical. L’option agent est simulée et ne constitue pas un transfert humain réel.
- Les horaires et messages sont des exemples à faire valider par l’organisation. Le français est l’unique langue proposée dans cette version; toute langue locale doit être validée par des locuteurs natifs.

Une mise en production téléphonique exige notamment un opérateur agréé et son provisionnement, l’audit réseau/site, une plateforme PBX/SBC et un hébergement adaptés, une authentification et des contrôles d’accès, ainsi que la validation métier, juridique et sécurité. Aucun de ces éléments n’est fourni ou présumé par ce dépôt.

Voir [l’architecture téléphonique de référence](docs/architecture-telephone.md) pour les différences FXO/FXS/ATA/SIP, le choix pilote local, les variantes possibles, les exigences de continuité et la recette à réaliser sur site.

## Publication GitHub

Le workflow `.github/workflows/pages.yml` publie l’application statique sur GitHub Pages après un push sur `main` ou sur la branche de démonstration, ou à la demande via `workflow_dispatch`. Il ne requiert aucun secret applicatif. Dans les paramètres du dépôt, GitHub Pages doit utiliser **GitHub Actions** comme source. Une fois le workflow terminé, GitHub affiche l’URL publique dans l’environnement `github-pages` et dans les détails de l’exécution.

GitHub Pages est un hébergement public de fichiers statiques : les données de démonstration restent dans le navigateur de chaque visiteur. Ce déploiement n’active ni la téléphonie ni une collecte centralisée.
