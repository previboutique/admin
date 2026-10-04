// © 2026 Admin Formation — Jérémy Bizeul — SARL Prévisecours. Tous droits réservés.
// positionnement_donnees.js — questions de départ du questionnaire de positionnement (reprises du formulaire Microsoft Forms
// « Questionnaire diagnostique », 60 questions, 4 thèmes). Les bonnes réponses non évidentes ne sont PAS définies : à renseigner
// dans l'écran « Questions de positionnement ». Utilisé uniquement par le bouton « Importer les questions de départ ».
const POSITIONNEMENT_DONNEES = [
 {
  "theme": "Secourisme",
  "questions": [
   {
    "libelle": "Quel est le n° d’appel européen des secours ?",
    "type": "unique",
    "options": [
     {
      "texte": "115",
      "correct": false
     },
     {
      "texte": "112",
      "correct": true
     },
     {
      "texte": "18",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Si la sirène d’alerte municipale sonne sans s’arrêter, que dois -je faire ?",
    "type": "unique",
    "options": [
     {
      "texte": "Aller chercher mes enfants à l’école",
      "correct": false
     },
     {
      "texte": "Rester là où je suis et attendre des consignes",
      "correct": true
     },
     {
      "texte": "Me calfeutrer dans une pièce fermée et chercher des informations à la radio",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Si une victime saigne abondamment du nez, je lui demande de :",
    "type": "unique",
    "options": [
     {
      "texte": "Pencher la tête en arrière",
      "correct": false
     },
     {
      "texte": "Pencher la tête en avant",
      "correct": true
     },
     {
      "texte": "Je ne sais pas",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Qui peut utiliser un défibrillateur comme ceux qu’on trouve aujourd’hui dans la plupart des lieux publics ?",
    "type": "unique",
    "options": [
     {
      "texte": "Les services d’urgence uniquement ?",
      "correct": false
     },
     {
      "texte": "Les secouristes formés uniquement ?",
      "correct": false
     },
     {
      "texte": "Les secouristes formés mais aussi le public non formé en cas de nécessité ?",
      "correct": true
     }
    ]
   },
   {
    "libelle": "Quand on parle de PLS, il s’agit de :",
    "type": "unique",
    "options": [
     {
      "texte": "Priorité à la sécurité",
      "correct": false
     },
     {
      "texte": "Position latérale de sécurité",
      "correct": true
     },
     {
      "texte": "Je ne sais pas",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Devant une personne qui manifeste des signes de malaise, il convient de :",
    "type": "unique",
    "options": [
     {
      "texte": "Lui donner du sucre",
      "correct": false
     },
     {
      "texte": "Lui demander de s’allonger",
      "correct": true
     },
     {
      "texte": "L’accompagner à l’hôpital",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Dans l’atelier dans lequel vous travaillez, une machine présente un fonctionnement anormal, que dois-je faire ?",
    "type": "unique",
    "options": [
     {
      "texte": "Tant pis, ça ira quand même tant que je fais attention !",
      "correct": false
     },
     {
      "texte": "Je préviens un responsable car il en va de ma sécurité",
      "correct": true
     }
    ]
   },
   {
    "libelle": "Les médicaments sont-ils autorisés dans un établissement sans infirmière ou médecin ?",
    "type": "unique",
    "options": [
     {
      "texte": "Oui",
      "correct": false
     },
     {
      "texte": "Non",
      "correct": true
     },
     {
      "texte": "Je ne sais pas",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Au travail, je peux emmener une victime à l’hôpital :",
    "type": "unique",
    "options": [
     {
      "texte": "Non",
      "correct": false
     },
     {
      "texte": "Oui",
      "correct": false
     },
     {
      "texte": "Oui s'il existe une procédure interne",
      "correct": false
     },
     {
      "texte": "Oui si le médecin régulateur me le demande",
      "correct": false
     }
    ]
   },
   {
    "libelle": "En secourisme, qu’est-ce qu’un EPI ?",
    "type": "unique",
    "options": [
     {
      "texte": "Equipier de Première Intervention",
      "correct": false
     },
     {
      "texte": "Equipement de Protection Individuel",
      "correct": true
     }
    ]
   },
   {
    "libelle": "AVC signifie ?",
    "type": "unique",
    "options": [
     {
      "texte": "Affection Vasculaire et Cardiaque",
      "correct": false
     },
     {
      "texte": "Accident Vasculaire et Cardiaque",
      "correct": false
     },
     {
      "texte": "Accident Vasculaire Cérébral",
      "correct": true
     }
    ]
   },
   {
    "libelle": "Face à une brulure thermique :",
    "type": "unique",
    "options": [
     {
      "texte": "Je refroidis immédiatement la surface brûlée par ruissellement d'eau courante FROIDE",
      "correct": false
     },
     {
      "texte": "Je refroidis immédiatement la surface brûlée par ruissellement d'eau courante TEMPÉRÉE",
      "correct": false
     },
     {
      "texte": "Je refroidis immédiatement la surface brûlée par ruissellement d'eau courante CHAUDE",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Je peux utiliser un Défibrillateur Automatisé Externe sans formation ?",
    "type": "unique",
    "options": [
     {
      "texte": "Vrai",
      "correct": true
     },
     {
      "texte": "Faux",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Face à une victime se plaignant d'un traumatisme au bras ?",
    "type": "unique",
    "options": [
     {
      "texte": "Inviter la victime à bouger son bras afin de s'assurer qu'il s'agit bien d'une fracture",
      "correct": false
     },
     {
      "texte": "Conseiller fermement à la victime de ne pas mobiliser son bras",
      "correct": true
     }
    ]
   },
   {
    "libelle": "En présence d'un corps étranger dans une plaie ?",
    "type": "unique",
    "options": [
     {
      "texte": "Je le retire immédiatement",
      "correct": false
     },
     {
      "texte": "Je ne le retire pas",
      "correct": true
     }
    ]
   }
  ]
 },
 {
  "theme": "Incendie",
  "questions": [
   {
    "libelle": "Combien de type de feu existe-t-il ?",
    "type": "unique",
    "options": [
     {
      "texte": "3",
      "correct": false
     },
     {
      "texte": "4",
      "correct": false
     },
     {
      "texte": "5",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Quel élément n'est pas le bon dans la constitution du triangle du feu ?",
    "type": "unique",
    "options": [
     {
      "texte": "Combustible",
      "correct": false
     },
     {
      "texte": "Fumée",
      "correct": true
     },
     {
      "texte": "Comburant",
      "correct": false
     }
    ]
   },
   {
    "libelle": "La transmission du feu par conduction se fait par les mouvements d'air ?",
    "type": "unique",
    "options": [
     {
      "texte": "Vrai",
      "correct": false
     },
     {
      "texte": "Faux",
      "correct": true
     },
     {
      "texte": "Je ne sais pas",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Qui peut utiliser un extincteur ?",
    "type": "unique",
    "options": [
     {
      "texte": "Les services de sécurité uniquement",
      "correct": false
     },
     {
      "texte": "Les personnels formés uniquement",
      "correct": false
     },
     {
      "texte": "Les personnels formés mais aussi le public non formé en cas de nécessité",
      "correct": true
     }
    ]
   },
   {
    "libelle": "Quelle est la cause principale de décès dans les incendies ?",
    "type": "unique",
    "options": [
     {
      "texte": "Le feu",
      "correct": false
     },
     {
      "texte": "Les fumées",
      "correct": true
     }
    ]
   },
   {
    "libelle": "Quel est le gaz qui est responsable en premier des intoxications gazeuses dans un incendie ?",
    "type": "unique",
    "options": [
     {
      "texte": "L'oxygène",
      "correct": false
     },
     {
      "texte": "Le radon",
      "correct": false
     },
     {
      "texte": "Le monoxyde de carbone",
      "correct": true
     }
    ]
   },
   {
    "libelle": "Quelle catégorie de gaz n'est pas toxique ?",
    "type": "multiple",
    "options": [
     {
      "texte": "Gaz irritants",
      "correct": false
     },
     {
      "texte": "Gaz hilarant",
      "correct": true
     },
     {
      "texte": "Gaz asphyxiant",
      "correct": false
     }
    ]
   },
   {
    "libelle": "En cas d'inflammation des vêtements d'une victime, je la déshabille ?",
    "type": "unique",
    "options": [
     {
      "texte": "Oui",
      "correct": false
     },
     {
      "texte": "Non",
      "correct": true
     },
     {
      "texte": "Je ne sais pas",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Je peux emmener une victime à l'hôpital ?",
    "type": "unique",
    "options": [
     {
      "texte": "Non",
      "correct": false
     },
     {
      "texte": "Oui",
      "correct": false
     },
     {
      "texte": "Oui si le médecin régulateur me le demande",
      "correct": false
     }
    ]
   },
   {
    "libelle": "En incendie, qu'est-ce qu'un EPI ?",
    "type": "unique",
    "options": [
     {
      "texte": "Equipier de Premiere Intervention",
      "correct": false
     },
     {
      "texte": "Equipement de Protection Individuel",
      "correct": true
     }
    ]
   }
  ]
 },
 {
  "theme": "Gestes et Postures",
  "questions": [
   {
    "libelle": "Que signifie TMS",
    "type": "unique",
    "options": [
     {
      "texte": "Tassement Musculaire Squelettique",
      "correct": false
     },
     {
      "texte": "Trouble Masculin du Squelette",
      "correct": false
     },
     {
      "texte": "Technique de Manutention Simplifiée",
      "correct": false
     },
     {
      "texte": "Trouble Musculo-Squelettique",
      "correct": true
     }
    ]
   },
   {
    "libelle": "Les troubles musculo squelettiques sont la prmeieres cause de maladie professionnel",
    "type": "unique",
    "options": [
     {
      "texte": "Vrai",
      "correct": true
     },
     {
      "texte": "Faux",
      "correct": false
     }
    ]
   },
   {
    "libelle": "La démarche globale de prévention des TMS consiste à :",
    "type": "unique",
    "options": [
     {
      "texte": "Organiser ou réorganiser les postes de travail",
      "correct": false
     },
     {
      "texte": "Aménager les poste de travail",
      "correct": false
     },
     {
      "texte": "Former le personnel afin de le sensibiliser sur les risques",
      "correct": false
     },
     {
      "texte": "Doter le personnel d'aides à la manutention (mécaniser les manutention",
      "correct": false
     }
    ]
   },
   {
    "libelle": "A votre avis, combien de personnes ont ou auront mal au dos en France ?",
    "type": "unique",
    "options": [
     {
      "texte": "20%",
      "correct": false
     },
     {
      "texte": "50%",
      "correct": false
     },
     {
      "texte": "80%",
      "correct": true
     },
     {
      "texte": "100%",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Réaliser des échauffements réduit le risque d'accident liés à la manutention",
    "type": "unique",
    "options": [
     {
      "texte": "Vrai",
      "correct": true
     },
     {
      "texte": "Faux",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Quel est le poids maximum qu’un homme est autorisé à porter selon le code du travail ?",
    "type": "unique",
    "options": [
     {
      "texte": "15 kg",
      "correct": false
     },
     {
      "texte": "25 kg",
      "correct": false
     },
     {
      "texte": "55 kg",
      "correct": true
     },
     {
      "texte": "ça dépend du poids de la personne",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Quel est le poids maximum qu’une femme est autorisé à porter selon le code du travail ?",
    "type": "unique",
    "options": [
     {
      "texte": "15 kg",
      "correct": false
     },
     {
      "texte": "25 kg",
      "correct": true
     },
     {
      "texte": "55 kg",
      "correct": false
     },
     {
      "texte": "ça dépend du poids de la personne",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Quelle est la pression, en kg, exercée sur nos vertèbres lombaires en portant une charge de 25 kg avec le dos courbé et les jambes droites ?",
    "type": "unique",
    "options": [
     {
      "texte": "25 kg",
      "correct": false
     },
     {
      "texte": "100 kg",
      "correct": false
     },
     {
      "texte": "250 kg",
      "correct": false
     },
     {
      "texte": "375 kg",
      "correct": true
     }
    ]
   },
   {
    "libelle": "En France, quel est le pourcentage des accidents du travail liés à la manutention manuelle ?",
    "type": "unique",
    "options": [
     {
      "texte": "10 %",
      "correct": false
     },
     {
      "texte": "25 %",
      "correct": false
     },
     {
      "texte": "40 %",
      "correct": false
     },
     {
      "texte": "60 %",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Quels sont les dommages musculaires que nous pouvons rencontrer?",
    "type": "multiple",
    "options": [
     {
      "texte": "Contracture",
      "correct": true
     },
     {
      "texte": "Elongation",
      "correct": true
     },
     {
      "texte": "Claquage",
      "correct": true
     },
     {
      "texte": "Déchirure",
      "correct": true
     },
     {
      "texte": "Crampe",
      "correct": true
     }
    ]
   },
   {
    "libelle": "Quels sont les dommages vertébraux que nous pouvons rencontrer ?",
    "type": "multiple",
    "options": [
     {
      "texte": "Lumbago",
      "correct": true
     },
     {
      "texte": "Sciatique",
      "correct": true
     },
     {
      "texte": "Hernie",
      "correct": true
     },
     {
      "texte": "Tassement",
      "correct": true
     }
    ]
   },
   {
    "libelle": "Les mauvaises postures sont elles à l'origine des majorités des maux de dos?",
    "type": "unique",
    "options": [
     {
      "texte": "Vrai",
      "correct": true
     },
     {
      "texte": "Faux",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Quelle est la pression, en kg, exercée sur nos vertèbres lombaires en portant une charge de 25 kg avec un bonne posture ?",
    "type": "unique",
    "options": [
     {
      "texte": "55 kg",
      "correct": false
     },
     {
      "texte": "75 kg",
      "correct": false
     },
     {
      "texte": "105 kg",
      "correct": false
     },
     {
      "texte": "125 kg",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Appliquer les principes de manutention manuelle, après une formation, permet de diviser le risque par :",
    "type": "unique",
    "options": [
     {
      "texte": "2",
      "correct": false
     },
     {
      "texte": "3",
      "correct": false
     },
     {
      "texte": "5",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Lors d'un travail continuel sur ordinateur, il est préférable de :",
    "type": "unique",
    "options": [
     {
      "texte": "Faire des petites pauses fréquentes",
      "correct": true
     },
     {
      "texte": "Faire des pauses plus longues mais moins souvent",
      "correct": false
     },
     {
      "texte": "Ne pas faire de pause et finir aussi vite que possible",
      "correct": false
     }
    ]
   }
  ]
 },
 {
  "theme": "Préparation à l'habilitation électrique",
  "questions": [
   {
    "libelle": "Le courant électrique est-il dangereux pour le corps humain ?",
    "type": "unique",
    "options": [
     {
      "texte": "Oui",
      "correct": true
     },
     {
      "texte": "Non",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Il y a–t-il une différence apparente entre un conducteur électrique hors tension et sous tension ?",
    "type": "unique",
    "options": [
     {
      "texte": "Oui",
      "correct": false
     },
     {
      "texte": "Non",
      "correct": true
     }
    ]
   },
   {
    "libelle": "En courant alternatif, quelles sont les limites du domaine de tension TBT (Très Basse Tension) ?",
    "type": "unique",
    "options": [
     {
      "texte": "0 v à 50 v",
      "correct": true
     },
     {
      "texte": "Au-delà de 50 V et jusqu’à 1 000 V inclus.",
      "correct": false
     },
     {
      "texte": "Au-delà de 1 000 V et jusqu’à 50 000 V inclus.",
      "correct": false
     },
     {
      "texte": "Au-delà de 50 000 V.",
      "correct": false
     }
    ]
   },
   {
    "libelle": "En courant alternatif, quelles sont les limites du domaine de tension BT(Basse Tension) ?",
    "type": "unique",
    "options": [
     {
      "texte": "0 v à 50 v",
      "correct": false
     },
     {
      "texte": "Au-delà de 50 V et jusqu’à 1 000 V inclus.",
      "correct": true
     },
     {
      "texte": "Au-delà de 1 000 V et jusqu’à 50 000 V inclus.",
      "correct": false
     },
     {
      "texte": "Au-delà de 50 000 V.",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Quels sont les risques présentés par une intervention sur un circuit BT (Basse Tension) ?",
    "type": "multiple",
    "options": [
     {
      "texte": "Brûlures",
      "correct": false
     },
     {
      "texte": "Projections de particules.",
      "correct": false
     },
     {
      "texte": "Électrisation",
      "correct": false
     },
     {
      "texte": "Électrocution",
      "correct": false
     },
     {
      "texte": "Inhalation de gaz nocifs.",
      "correct": false
     }
    ]
   },
   {
    "libelle": "L’électrocution signifie :",
    "type": "unique",
    "options": [
     {
      "texte": "Mourir par électrisation",
      "correct": true
     },
     {
      "texte": "Conducteur parcouru par un courant électrique",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Un contact direct peut être la conséquence :",
    "type": "multiple",
    "options": [
     {
      "texte": "D’une négligence",
      "correct": false
     },
     {
      "texte": "D’un appareil en défaut d’isolement",
      "correct": false
     },
     {
      "texte": "Du non-respect des consignes de sécurité",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Quelle est la fonction d’un disjoncteur :",
    "type": "multiple",
    "options": [
     {
      "texte": "Protection contre les contacts directs",
      "correct": false
     },
     {
      "texte": "Coupure automatique en cas de défaut d’isolement",
      "correct": false
     },
     {
      "texte": "Détection des courts-circuits",
      "correct": false
     },
     {
      "texte": "Détection des surcharges",
      "correct": false
     },
     {
      "texte": "Protection des circuits électriques",
      "correct": false
     },
     {
      "texte": "Isoler un circuit de sa source",
      "correct": false
     },
     {
      "texte": "Interrompre ou mettre en service un circuit électrique",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Quelle est la fonction d’un interrupteur :",
    "type": "unique",
    "options": [
     {
      "texte": "Protection contre les contacts directs",
      "correct": false
     },
     {
      "texte": "Coupure automatique en cas de défaut d’isolement",
      "correct": false
     },
     {
      "texte": "Détection des courts-circuits",
      "correct": false
     },
     {
      "texte": "Détection des surcharges",
      "correct": false
     },
     {
      "texte": "Protection des circuits électriques",
      "correct": false
     },
     {
      "texte": "Isoler un circuit de sa source",
      "correct": false
     },
     {
      "texte": "Interrompre ou mettre en service un circuit électrique",
      "correct": true
     }
    ]
   },
   {
    "libelle": "Les accidents d’origine électriques sont, vis-à-vis des accidents ordinaires",
    "type": "unique",
    "options": [
     {
      "texte": "2 fois plus mortel",
      "correct": false
     },
     {
      "texte": "5 fois plus mortel",
      "correct": false
     },
     {
      "texte": "15 fois plus mortel",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Mon habilitation électrique est soumise à aptitude médicale",
    "type": "unique",
    "options": [
     {
      "texte": "Vrai",
      "correct": true
     },
     {
      "texte": "Faux",
      "correct": false
     }
    ]
   },
   {
    "libelle": "en cas de doute, j’arrête les travaux et je rends compte au chargé de chantier",
    "type": "unique",
    "options": [
     {
      "texte": "Vrai",
      "correct": true
     },
     {
      "texte": "Faux",
      "correct": false
     }
    ]
   },
   {
    "libelle": "Un câble haute tension sectionné au sol ne présente plus de danger",
    "type": "unique",
    "options": [
     {
      "texte": "Vrai",
      "correct": false
     },
     {
      "texte": "Faux",
      "correct": true
     }
    ]
   },
   {
    "libelle": "Un incendie d’origine électrique peut être lié à :",
    "type": "multiple",
    "options": [
     {
      "texte": "La vétusté d'une installation électrique",
      "correct": false
     },
     {
      "texte": "Une installation électrique qui n'est pas aux normes",
      "correct": false
     },
     {
      "texte": "La surcharge d’une multiprise",
      "correct": false
     },
     {
      "texte": "L’endommagement d’une gaine électrique",
      "correct": false
     }
    ]
   },
   {
    "libelle": "L’habilitation électrique est délivrée par :",
    "type": "unique",
    "options": [
     {
      "texte": "L'employeur",
      "correct": true
     },
     {
      "texte": "L'organisme de formation",
      "correct": false
     },
     {
      "texte": "L'organisme de contrôle périodique électrique",
      "correct": false
     }
    ]
   }
  ]
 }
];
