import {
  grilleFrequence,
  grilleGravite,
  grilleMaitrise,
  niveauxCriticite,
  type Echelon,
} from "@/lib/referentiel";
import { niveauDe } from "@/lib/calculs";

function TableEchelons({ titre, question, echelons }: { titre: string; question: string; echelons: Echelon[] }) {
  return (
    <div>
      <h3 className="font-serif text-lg">{titre}</h3>
      <p className="mt-1 text-sm text-ardoise">{question}</p>
      <table className="mt-3 w-full text-sm">
        <tbody>
          {echelons.map((e) => (
            <tr key={e.valeur} className="border-t border-pierre/60 align-top">
              <td className="w-10 py-2 pr-2 text-xl font-semibold text-bronze-fonce tabular-nums">{e.valeur}</td>
              <td className="py-2">
                <p className="font-medium">{e.libelle}</p>
                <p className="text-ardoise">{e.definition}</p>
                <p className="mt-0.5 text-xs text-gris">Exemples : {e.exemples}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GuideCotation() {
  return (
    <div id="guide" className="space-y-8">
      <div className="rounded-sm bg-encre p-5 text-marbre">
        <p className="text-xs uppercase tracking-[0.25em] text-bronze-clair">La méthode Frisk en 3 questions</p>
        <ol className="mt-3 grid gap-4 text-sm sm:grid-cols-3">
          <li>
            <p className="font-serif text-base">1. Si ça arrive, est-ce grave ?</p>
            <p className="mt-1 text-pierre">On note la <strong>gravité</strong> de 1 à 4.</p>
          </li>
          <li>
            <p className="font-serif text-base">2. Est-on souvent exposé ?</p>
            <p className="mt-1 text-pierre">On note la <strong>fréquence</strong> de 1 à 4.</p>
          </li>
          <li>
            <p className="font-serif text-base">3. Est-on déjà bien protégé ?</p>
            <p className="mt-1 text-pierre">On choisit le niveau de <strong>maîtrise</strong>.</p>
          </li>
        </ol>
        <div className="mt-5 grid gap-2 border-t border-white/10 pt-4 text-sm sm:grid-cols-2">
          <p>
            <span className="text-bronze-clair">Criticité brute</span> = Gravité × Fréquence (de 1 à 16).
            C&apos;est le risque « tel quel », sans tenir compte des protections.
          </p>
          <p>
            <span className="text-bronze-clair">Risque résiduel</span> = Criticité brute × coefficient de maîtrise.
            C&apos;est le risque qui reste malgré les mesures déjà en place : c&apos;est lui qui fixe la priorité.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <TableEchelons
          titre="Gravité (G)"
          question="Quelles seraient les conséquences les plus probables pour le salarié si le risque se réalisait ?"
          echelons={grilleGravite}
        />
        <TableEchelons
          titre="Fréquence d'exposition (F)"
          question="À quelle fréquence le salarié est-il en contact avec le danger ?"
          echelons={grilleFrequence}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h3 className="font-serif text-lg">Maîtrise du risque</h3>
          <p className="mt-1 text-sm text-ardoise">
            Les mesures de prévention déjà en place réduisent-elles le risque ? Le coefficient diminue la criticité brute.
          </p>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {grilleMaitrise.map((m) => (
                <tr key={m.valeur} className="border-t border-pierre/60 align-top">
                  <td className="w-14 py-2 pr-2 font-semibold text-bronze-fonce tabular-nums">× {m.coefficient}</td>
                  <td className="py-2">
                    <p className="font-medium">{m.libelle}</p>
                    <p className="text-ardoise">{m.definition}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h3 className="font-serif text-lg">Matrice de criticité brute</h3>
          <p className="mt-1 text-sm text-ardoise">Chaque case donne G × F et le niveau correspondant.</p>
          <div className="mt-3 grid grid-cols-[auto_repeat(4,1fr)] gap-[2px] text-center text-sm">
            <span />
            {grilleFrequence.map((f) => (
              <span key={f.valeur} className="pb-1 text-xs text-gris">
                F{f.valeur} {f.libelle}
              </span>
            ))}
            {[...grilleGravite].reverse().map((g) => (
              <div key={g.valeur} className="contents">
                <span className="flex items-center pr-2 text-xs text-gris">
                  G{g.valeur} {g.libelle}
                </span>
                {grilleFrequence.map((f) => {
                  const score = g.valeur * f.valeur;
                  const n = niveauDe(score);
                  return (
                    <span
                      key={f.valeur}
                      className="rounded-[4px] py-3 font-semibold"
                      style={{ background: n.couleur, color: n.texte }}
                      title={`${score} — ${n.libelle}`}
                    >
                      {score}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-serif text-lg">Niveaux de risque et délais d&apos;action</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {niveauxCriticite.map((n, i) => {
            const max = niveauxCriticite[i + 1]?.min;
            return (
              <div key={n.code} className="rounded-sm border border-pierre/70 bg-white p-4">
                <span
                  className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{ background: n.couleur, color: n.texte }}
                >
                  {n.libelle}
                </span>
                <p className="mt-2 text-xs text-gris">
                  Score {max ? `de ${n.min} à moins de ${max}` : `de ${n.min} à 16`} · {n.delai}
                </p>
                <p className="mt-1 text-sm text-ardoise">{n.definition}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
