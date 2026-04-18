# OrderPilot — Checklist, améliorations possibles et audit sécurité

_Date : 16 avril 2026_

## 1) Checklist opérationnelle (MVP → production)

### Produit
- [ ] Définir les 3 offres (Starter / Pro / Business) + limites (enseignes, utilisateurs, exports).
- [ ] Ajouter une page "Tarifs" + conditions d’essai.
- [ ] Mettre en place onboarding (import enseignes + 1ère livraison guidée).
- [ ] Ajouter FAQ in-app (livraisons récurrentes, impression bons, ventes).
- [ ] Définir KPI produit: activation J+1, rétention M+1, churn, MRR.

### Technique
- [ ] Mettre en place migrations versionnées (au lieu de SQL manuel uniquement).
- [ ] Ajouter validation de schéma côté API (ex: Zod/Joi) en complément des règles actuelles.
- [ ] Ajouter logs structurés (niveau, user_id, route, durée, request_id).
- [ ] Ajouter pagination sur les listes volumineuses (livraisons, ventes, produits).
- [ ] Ajouter cache léger sur endpoints dashboard/summary.

### Qualité
- [ ] Ajouter tests E2E (auth, création livraison, édition, impression).
- [ ] Couvrir cas limites récurrents (fin de mois, février, jours 29/30/31).
- [ ] Ajouter tests de non-régression sur calculs HT/TTC et quantités nettes.
- [ ] Ajouter CI (lint + tests backend + tests frontend + build).

### Exploitation
- [ ] Mettre en place monitoring uptime + alerting erreurs 5xx.
- [ ] Sauvegardes PostgreSQL automatisées + test restauration mensuel.
- [ ] Mettre en place politique de rotation des secrets.
- [ ] Définir RTO/RPO (continuité de service).

### Légal / conformité (France/UE)
- [ ] Publier CGU/CGV + politique de confidentialité.
- [ ] Ajouter bannière cookies si nécessaire.
- [ ] Documenter DPA/RGPD (durée conservation, droit suppression/export).
- [ ] Journaliser consentements et actions sensibles.

---

## 2) Améliorations possibles (priorisées)

## Priorité haute (30 jours)
1. **Sécuriser l’authentification web**
   - Migrer du token en `localStorage` vers cookie HttpOnly + `SameSite` + `Secure`.
2. **Durcir la gestion JWT**
   - Interdire secret par défaut en production.
   - Ajouter rotation de clés + expiration plus courte + refresh token.
3. **Ajout observabilité**
   - Logs structurés + traces erreurs + métriques API (latence p95, taux 4xx/5xx).
4. **Facturation SaaS**
   - Intégrer Stripe (essai, abonnement, relance, annulation).

## Priorité moyenne (30–90 jours)
1. **Multi-utilisateurs par entreprise** (roles owner/admin/opérateur).
2. **Exports avancés** (PDF/CSV comptable, TVA, période custom).
3. **Notifications** (mail/SMS WhatsApp veille livraison).
4. **Planification intelligente** (suggestions de quantités via historique).
5. **Mode mobile terrain** (PWA offline partiel + synchro).

## Priorité long terme (90+ jours)
1. **Intégrations ERP/compta** (Sage, Pennylane, QuickBooks).
2. **Connecteurs marketplaces / e-commerce**.
3. **Assistant IA** pour prévision de tournées et anomalies.

---

## 3) Audit sécurité (snapshot du code actuel)

## Résumé
- **Niveau global estimé : Moyen**
- **Points forts :**
  - Requêtes SQL paramétrées (réduction injection SQL).
  - `helmet` actif.
  - `express-rate-limit` actif sur auth.
  - Vérification ownership (`user_id`) présente sur endpoints métier.

- **Risques principaux :**
  1. Secret JWT de secours non sûr.
  2. Token en `localStorage` (surface XSS).
  3. Pas de révocation/session management granulaire.

## Détails des constats

### Critique
1. **Secret JWT par défaut en fallback**
   - Impact: si variable absente en prod, compromission potentielle de tous les tokens.
   - Action: refuser le démarrage si `JWT_SECRET` absent/faible en production.

### Élevé
2. **Stockage token dans `localStorage`**
   - Impact: en cas de XSS, vol de session immédiat.
   - Action: passer en cookies HttpOnly + stratégie CSRF adaptée.

3. **Pas de mécanisme de révocation/rotation active des sessions**
   - Impact: token volé reste valide jusqu’à expiration.
   - Action: refresh token rotatif + blacklist sur incident + logout global.

### Moyen
4. **Rate limiting seulement sur auth**
   - Impact: endpoints métier potentiellement abusables (scraping/DoS applicatif).
   - Action: ajouter limite globale + limites spécifiques routes sensibles.

5. **Politique mot de passe minimale (8 chars)**
   - Impact: résistance brute force limitée.
   - Action: renforcer complexité/longueur + blocage progressif + captcha adaptatif.

6. **TLS DB avec `rejectUnauthorized: false` en prod (si DATABASE_URL)**
   - Impact: validation certif permissive.
   - Action: activer validation stricte si l’hébergeur le permet.

7. **Logs d’erreur potentiellement verbeux**
   - Impact: fuite d’infos techniques/PII en observabilité.
   - Action: redaction/sanitization des logs + niveau selon environnement.

### Faible
8. **Pas de headers CSP explicites**
   - Impact: protection XSS non optimale côté navigateur.
   - Action: configurer CSP stricte via Helmet.

9. **Absence de scan dépendances automatisé**
   - Impact: vulnérabilités connues non détectées tôt.
   - Action: `npm audit` en CI + Dependabot/Renovate.

---

## 4) Plan d’action sécurité recommandé

## Sprint 1 (immédiat, 1–2 semaines)
- [ ] Supprimer fallback JWT secret en production.
- [ ] Mettre rate-limit global API + limites ciblées.
- [ ] Ajouter validation forte des mots de passe et anti brute force.
- [ ] Ajouter CSP, HSTS, et configuration CORS stricte par environnement.

## Sprint 2 (2–4 semaines)
- [ ] Migrer auth vers cookies HttpOnly + CSRF token.
- [ ] Ajouter refresh token rotatif + révocation session.
- [ ] Ajouter logs structurés + redaction données sensibles.
- [ ] Mettre scans SCA/SAST en CI.

## Sprint 3 (4–8 semaines)
- [ ] Audit pentest externe léger.
- [ ] Tableau de bord sécurité (incidents, latence, erreurs, auth failures).
- [ ] Procédure de réponse à incident + runbook restauration.

---

## 5) Conclusion

Le produit est déjà solide pour un MVP métier. Pour une commercialisation plus large, le meilleur ROI court terme est:
1) durcissement auth/session,
2) observabilité/backup,
3) packaging SaaS (facturation + onboarding).

Ces actions augmentent à la fois la confiance client, la stabilité et la capacité à vendre plus cher.
