# SVI Mali — administrations maliennes

MVP SaaS de démonstration du serveur vocal interactif (SVI), conçu à partir des dossiers fonctionnel et d’architecture. L’application permet de configurer un court menu français, de simuler la navigation DTMF, de gérer des profils d’extensions SIP et des postes analogiques décrits sur site, de téléverser et associer des annonces audio et d’exporter les paramètres.

## Utiliser la démonstration

Ouvrir la démonstration publiée en HTTPS, ou servir le dossier avec un serveur HTTP statique sur `localhost` pour utiliser les fonctionnalités de stockage audio. L’ouverture directe en `file://` peut empêcher le navigateur d’accéder à IndexedDB. Aucun paquet tiers n’est nécessaire pour l’application; Node.js 20 ou plus récent est uniquement requis pour les tests.

```sh
npm test
```

Les réglages, rappels, extensions et événements de simulation sont stockés localement dans le navigateur. Les fichiers d’annonces audio restent dans IndexedDB sur l’appareil qui les a téléversés; ils ne sont ni téléversés vers un serveur ni inclus au dépôt. Une extension peut être exportée en JSON, ou la configuration peut l’être en un seul fichier. Les exports ne contiennent aucun secret SIP et signalent que le provisionnement matériel n’est pas réalisé. Les événements ne contiennent ni numéro d’appelant ni audio. Les numéros ne sont conservés que pour les demandes de rappel explicites. Les rapports et appels expirent après 30 jours; un rappel clôturé expire après 7 jours. « Effacer les données de démonstration » supprime immédiatement la configuration locale et les fichiers audio du navigateur.

## Portée et limites

- Cette livraison est un **MVP web de démonstration**, et non un PBX, un serveur SIP ou une plateforme d’appels.
- Aucun numéro, opérateur, trunk SIP, PBX, transfert réel, agent, SMS, compte utilisateur ou service backend n’est configuré.
- Les données et fichiers audio locaux ne sont pas chiffrés, authentifiés ni synchronisés; ils sont accessibles depuis le profil de navigateur et peuvent être effacés par celui-ci. Ne pas saisir de données client, personnelles, confidentielles ou médicales.
- Seuls des messages audio approuvés peuvent être importés comme annonces statiques (WAV, MP3, OGG, AAC, M4A ou WebM; 10 Mo max. par fichier, 100 fichiers maximum). La lecture et les associations dans le simulateur sont locales. Aucun appel n’est enregistré, et aucun message n’est diffusé au téléphone. Les fichiers audio ne sont pas inclus dans les exports JSON; les noms, formats et associations le sont.
- Les profils « softphone » sont des fiches de préparation et des exemples de paramètres SIP (nom d’utilisateur, serveur, port, transport); ils ne créent pas un compte ou un secret sur un PBX et ne testent pas la connectivité. Créer le compte et son mot de passe séparément sur un PBX/PBXaaS sécurisé et remettre le secret par un canal protégé.
- Les postes analogiques sont descriptifs : ils documentent une passerelle FXS et un port sur site, mais ne configurent ni l’appareil ni la passerelle. Une ligne opérateur analogique aboutit à l’interface FXO du PBX/passerelle; FXS est la sortie vers le terminal, et un ATA adapte un terminal analogique à un compte SIP. L’accès Internet seul ne convertit pas une ligne PSTN ni ne pilote un téléphone analogique.
- Aucun renseignement sensible, résultat médical, identifiant ou donnée de paiement n’est demandé dans le menu. Le parcours de rappel n’accepte qu’un numéro et un motif général prédéfini.
- Le prototype ne pose aucun diagnostic et ne réalise aucun triage médical. L’option agent est simulée et ne constitue pas un transfert humain réel.
- Les horaires et messages sont des exemples à faire valider par l’organisation. Le français est l’unique langue proposée dans cette version; toute langue locale doit être validée par des locuteurs natifs.

Une mise en production téléphonique exige notamment un opérateur agréé et son provisionnement, l’audit réseau/site, une plateforme PBX/SBC et un hébergement adaptés, une authentification et des contrôles d’accès, ainsi que la validation métier, juridique et sécurité. Pour des lignes analogiques, l’architecture de pilote recommandée est un PBX/SVI local raccordé à l’opérateur par FXO : le menu peut alors continuer sans WAN si la ligne, le PBX et le LAN sont alimentés. Une UPS, les transferts, DTMF, pannes Internet/électriques, chemins de secours et retours arrière doivent être vérifiés sur site. L’export des paramètres ne déploie pas de PBX, ne configure aucun appareil ou ligne et ne vaut pas plan d’appel prêt à installer. Aucun de ces services n’est fourni ou présumé par ce dépôt.

Voir [l’architecture téléphonique de référence](docs/architecture-telephone.md) pour les différences FXO/FXS/ATA/SIP, le choix pilote local, les variantes possibles, les exigences de continuité et la recette à réaliser sur site.

## Publication GitHub

Le workflow `.github/workflows/pages.yml` publie l’application statique sur GitHub Pages après un push sur `main` ou sur la branche de démonstration, ou à la demande via `workflow_dispatch`. Il ne requiert aucun secret applicatif. Dans les paramètres du dépôt, GitHub Pages doit utiliser **GitHub Actions** comme source. Une fois le workflow terminé, GitHub affiche l’URL publique dans l’environnement `github-pages` et dans les détails de l’exécution.

GitHub Pages est un hébergement public de fichiers statiques : les données de démonstration restent dans le navigateur de chaque visiteur. Ce déploiement n’active ni la téléphonie ni une collecte centralisée.
