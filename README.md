# Frisk DU

Application de prévention des risques professionnels proposée par Frisk aux entreprises :

- **DUERP** en tableau éditable, avec guide de cotation (gravité, fréquence, maîtrise, criticité)
- **Pénibilité** : les 10 facteurs de risques professionnels et leurs seuils
- **EPI & stocks** : remises par salarié, stock par taille, stock tampon, quantités à commander
- **Bilans** de consommation façon Power BI (filtres et filtrage croisé)

## Lancer en local

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000.

## État actuel

Les données sont enregistrées dans le navigateur (localStorage). Prochaine étape : comptes par entreprise et
sauvegarde en ligne (Supabase), avec une console Frisk pour créer les comptes clients.
