# Architecture téléphonique de référence

Cette note complète le MVP web de démonstration SVI Mali et le dossier fonctionnel. Elle traduit les hypothèses du dossier technique en critères d’architecture. Elle ne constitue ni une offre opérateur, ni un plan d’installation validé pour un site.

## Principe à retenir

**L’accès Internet ne transforme pas une ligne téléphonique analogique en ligne IP.** Pour qu’un SVI réponde au numéro classique, il faut au moins l’un des raccordements suivants : un renvoi réellement fourni par l’opérateur vers un numéro joignable par le SVI, un raccordement physique de la ligne à un port FXO relié à un PBX/SVI, ou un accès téléphonique SIP contractuel fourni par l’opérateur. Aucune de ces prestations n’est configurée ou supposée disponible dans ce dépôt.

### Référence de pilote : PBX/SVI local + FXO

Pour un site qui possède une ligne analogique et peut accéder à sa terminaison, le point de départ recommandé est :

```text
Réseau opérateur ─ ligne analogique ─ FXO ─ PBX / SVI local ─ LAN ─ postes agents
                                               │
                                               └── Internet : administration et supervision
```

Le menu et le routage locaux peuvent rester fonctionnels lors d’une coupure Internet, **si** la ligne téléphonique, le PBX/passerelle et les équipements locaux restent alimentés et opérationnels. L’administration distante, les mises à jour et la supervision via Internet sont alors interrompues. Si la ligne est livrée par un ONT ou un autre équipement actif, elle n’est pas à considérer comme une ligne cuivre passive pendant une panne électrique.

Une ligne analogique n’offre généralement qu’un appel externe simultané. Plusieurs appels en parallèle nécessitent des lignes/ports supplémentaires ou un accès opérateur différent. Mesurer la simultanéité réelle avant tout dimensionnement.

## Interfaces et accès

| Terme | Rôle | À ne pas confondre |
|---|---|---|
| **FXO** | Reçoit une ligne analogique PSTN fournie par l’opérateur; relie cette ligne au PBX ou à une passerelle. | Port d’entrée opérateur, pas une sortie vers un téléphone analogique. |
| **FXS** | Fournit une ligne à un téléphone analogique ou un fax depuis un PBX/ATA. | Port de poste, pas le port pour raccorder directement la ligne opérateur. |
| **ATA** | Adapte un téléphone analogique à un compte SIP via son côté FXS. | N’adapte pas à lui seul la ligne analogique entrante et ne crée pas un SVI. |
| **Trunk SIP** | Accès téléphonique IP fourni sous contrat, avec canaux/capacité définis. | N’est pas inclus implicitement dans une connexion Internet. |

## Scénarios de raccordement

| Scénario | Quand l’étudier | Dépendances et limites |
|---|---|---|
| **1. Renvoi opérateur vers SVI hébergé** | Accès physique au local téléphonique impossible ou pilote rapide. | L’opérateur doit confirmer le renvoi, le numéro cible, la tarification, la présentation du numéro et la procédure de secours. Sans service confirmé, ce scénario ne fonctionne pas. |
| **2. PBX/SVI local + ligne FXO** | Ligne analogique disponible sur site, faible à moyen volume; référence initiale du pilote. | Dépend de la ligne et de l’alimentation locale; simultanéité limitée par le nombre de lignes analogiques. WAN non requis pour le menu local. |
| **3. Intégration du PBX existant** | Standard doté d’un auto-attendant ou d’interfaces d’insertion compatibles. | Auditer modèle, cartes, ports, licences et documentation; tester en préproduction et préparer un retour arrière. |
| **4. Hybride FXO + SIP** | Besoin de capacité ou de plusieurs destinations, avec ligne classique maintenue en secours lorsque possible. | Trunk SIP contractuel, canaux et chemin opérateur définis; règles de bascule et de retour testées. Une ligne analogique ne reprend pas automatiquement les appels destinés au trunk. |
| **5. Cloud / SIP** | Sites bien connectés dont la voix arrive en SIP ou peut être renvoyée par l’opérateur. | Dépendance au WAN, au trunk ou au renvoi, à l’hébergeur et à la localisation des données. Déconseillé comme unique chemin pour une connexion instable. |

Une variante hybride peut ajouter un trunk SIP au PBX local et conserver la ligne FXO. Ne retenir un chemin de secours que si son acheminement, ses coûts, ses capacités et ses essais sont documentés. La simple présence d’une ligne Internet ou d’un deuxième opérateur ne garantit pas une route de secours indépendante.

## Réseau, alimentation et sécurité

- Prévoir une UPS dimensionnée et testée pour le PBX, la passerelle FXO/FXS et les équipements LAN nécessaires. Ajouter ONT/routeur et switch PoE si la continuité WAN ou des postes IP est attendue. Documenter l’autonomie réelle et les conséquences de son épuisement.
- Séparer si possible voix, gestion et bureautique (VLAN/ACL); utiliser QoS, mesures de qualité et Ethernet câblé pour les postes critiques selon le matériel du site.
- Ne pas exposer de console PBX, SSH ou interface SIP sur Internet. Appliquer le refus par défaut au pare-feu; limiter SIP aux adresses opérateur ou à un tunnel approuvé, avec SBC/frontière de sécurité lorsque requis.
- Pour l’administration distante, utiliser un VPN, MFA, comptes nominatifs, rôles distincts et journaux. N’activer TLS/SRTP que si les équipements et l’opérateur les prennent en charge; sinon, documenter le risque et le réseau privé retenu.
- Restreindre les appels sortants et destinations coûteuses; mettre en place plafonds, alertes et arrêt d’urgence.

## Recette préalable à toute mise en service

Valider avec le client, le responsable métier et l’opérateur les appels entrants, les tonalités et choix DTMF, temporisation et absence de saisie, répétition, transferts et raccrochage. Tester saturation des lignes, appel bidirectionnel vers un agent, coupure Internet, coupure électrique sur UPS, panne PBX/passerelle, renvoi ou numéro de secours, sauvegarde/restauration et retour arrière. Vérifier depuis un réseau non approuvé que l’administration et SIP ne sont pas accessibles. Conserver les preuves et limites par site.

En particulier, un transfert vers un agent doit réellement aboutir, avec un chemin humain et une procédure hors service validés; le simulateur de cette application ne réalise aucun appel ni transfert.

## Informations à recueillir sur chaque site

Identifier le propriétaire et le type exact de terminaison téléphonique (ligne cuivre, sortie analogique d’ONT, poste FXS, PBX ou service IP), la marque/modèle du standard, le nombre de lignes et d’appels simultanés, l’accès physique au répartiteur, les options opérateur de renvoi/SIP, les horaires et destinations, le réseau/énergie/UPS, le numéro de secours, les exigences de données et les responsables de validation. Ne raccorder aucune ligne à un port FXO avant identification de sa nature.

Le choix final dépend de l’audit de site, du contrat opérateur, du coût total, de la sécurité et des essais. Cette note ne valide aucune offre, homologation ou exigence réglementaire; les responsables du client doivent faire confirmer ces éléments avant l’achat et la mise en service.

## Profils de préparation dans le MVP SaaS

L’écran « Extensions & postes » permet de garder sur l’appareil des fiches d’extensions SIP (identifiant, libellé et profil serveur/port/transport) et de documenter les postes analogiques derrière une passerelle FXS et un port. Il s’agit d’un inventaire et d’un export de préparation : aucun compte PBX n’est créé, aucun secret SIP n’est stocké ou exporté, aucun softphone n’est configuré à distance et aucun état d’enregistrement n’est mesuré. Les secrets doivent être créés et distribués séparément par un administrateur PBX via un canal sécurisé.

Les messages d’accueil et annonces peuvent être téléversés, écoutés, associés au menu et testés localement. Les fichiers (10 Mo maximum chacun, 100 fichiers au maximum) sont conservés dans l’IndexedDB du navigateur, sans serveur, chiffrement, synchronisation ou sauvegarde; éviter les annonces contenant des données personnelles et ne pas importer de messages d’appelants. L’export JSON ne transporte pas les fichiers audio : il ne contient que les références de nom/type/taille et les associations. Un intégrateur doit convertir, transférer, installer et tester les annonces sur le PBX réel. Cette fonction ne lève pas la désactivation de l’enregistrement des appels.
