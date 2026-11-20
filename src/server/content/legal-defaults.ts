import type { LocalizedText } from "../db/schema/content";

/**
 * Default legal texts, used while the matching settings are empty.
 * They describe the site as it works today and must be updated when contact
 * forms and audience measurement go live.
 */
export const DEFAULT_LEGAL_NOTICE: LocalizedText = {
  fr: `Éditeur du site
Isaac Akonkwa (Akonkwa Ushindi), ingénieur logiciel, Bukavu, République démocratique du Congo. Contact : akonkwaushindi@gmail.com.

Directeur de la publication
Isaac Akonkwa.

Hébergement
Le site est hébergé par un prestataire d'hébergement web. Ses coordonnées complètes sont communiquées sur simple demande à l'adresse ci-dessus.

Propriété intellectuelle
Les textes, visuels et réalisations présentés sur ce site sont la propriété d'Isaac Akonkwa ou de leurs auteurs respectifs. Toute reproduction sans autorisation préalable est interdite. Les noms et logos d'organisations cités appartiennent à leurs propriétaires.

Responsabilité
Les informations publiées sont fournies à titre indicatif. Les liens vers des sites externes n'engagent pas l'éditeur quant à leur contenu.`,
  en: `Publisher
Isaac Akonkwa (Akonkwa Ushindi), software engineer, Bukavu, Democratic Republic of the Congo. Contact: akonkwaushindi@gmail.com.

Publication director
Isaac Akonkwa.

Hosting
The site is hosted by a web hosting provider. Its full details are available on request at the address above.

Intellectual property
Texts, visuals and work presented on this site belong to Isaac Akonkwa or to their respective authors. Any reproduction without prior permission is prohibited. Names and logos of the organizations mentioned belong to their owners.

Liability
Published information is provided for guidance only. Links to external websites do not make the publisher responsible for their content.`,
};

export const DEFAULT_PRIVACY_POLICY: LocalizedText = {
  fr: `Responsable du traitement
Isaac Akonkwa, Bukavu, RDC. Contact : akonkwaushindi@gmail.com.

Données collectées
La consultation du site ne nécessite aucun compte. Le site ne dépose aucun cookie publicitaire ni cookie de suivi tiers. Votre préférence de thème (clair ou sombre) est enregistrée uniquement dans votre navigateur.

Journaux techniques et sécurité
Pour protéger le site contre les abus, le serveur peut enregistrer des informations techniques sur les requêtes (adresse IP, date, page demandée, navigateur). Ces données servent uniquement à la sécurité et sont conservées 12 mois au plus.

Échanges par e-mail ou WhatsApp
Lorsque vous écrivez directement, votre message et vos coordonnées sont utilisés uniquement pour vous répondre.

Vos droits
Vous pouvez demander l'accès, la rectification ou la suppression de vos données en écrivant à l'adresse ci-dessus.

Évolution
Cette politique sera mise à jour avant l'ouverture des formulaires de contact et de devis et de la mesure d'audience.`,
  en: `Data controller
Isaac Akonkwa, Bukavu, DRC. Contact: akonkwaushindi@gmail.com.

Data collected
Browsing the site requires no account. The site sets no advertising cookie and no third party tracking cookie. Your theme preference (light or dark) is stored in your browser only.

Technical logs and security
To protect the site against abuse, the server may log technical information about requests (IP address, date, requested page, browser). This data is used for security only and kept for 12 months at most.

Email or WhatsApp exchanges
When you write directly, your message and contact details are only used to reply to you.

Your rights
You may request access to, correction or deletion of your data by writing to the address above.

Changes
This policy will be updated before the contact and quote forms and audience measurement go live.`,
};
