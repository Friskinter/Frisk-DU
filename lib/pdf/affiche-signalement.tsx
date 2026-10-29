// Affiche A4 du lien de signalement, avec son QR code, à placer dans l'atelier, la salle de pause,
// les véhicules…

import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { c } from "./plan-prevention";
import type { Marque } from "@/lib/identite";
import { LogoDocument, MentionFrisk } from "./marque";

export function AfficheSignalement({ entreprise, lien, qr, marque }: { entreprise: string; lien: string; qr: string; marque: Marque }) {
  const etapes = ["Scannez le QR code avec l'appareil photo de votre téléphone.", "Dites ce qui s'est passé, où et quand.", "Ajoutez une photo si vous le pouvez, puis envoyez."];
  return (
    <Document title={`Signalement - ${entreprise}`} author={entreprise} creator="Frisk DU" producer="Frisk DU" language="fr">
      <Page size="A4" style={{ padding: 48, fontFamily: "Helvetica", color: c.encre, alignItems: "center" }}>
        <Text style={{ fontSize: 10, letterSpacing: 3, color: marque.accent, textTransform: "uppercase" }}>{entreprise}</Text>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 30, textAlign: "center", marginTop: 18, lineHeight: 1.25 }}>
          Un accident ?{"\n"}Un presque-accident ?{"\n"}Un danger ?
        </Text>
        <Text style={{ fontSize: 16, textAlign: "center", marginTop: 14, color: c.ardoise }}>Signalez-le en une minute avec votre téléphone.</Text>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- composant PDF, sans attribut alt */}
        <Image src={qr} style={{ width: 230, height: 230, marginTop: 26 }} />
        <View style={{ marginTop: 22, width: 400 }}>
          {etapes.map((e, n) => (
            <View key={e} style={{ flexDirection: "row", marginBottom: 8 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 13, width: 24, color: marque.accent }}>{n + 1}.</Text>
              <Text style={{ fontSize: 13, flex: 1 }}>{e}</Text>
            </View>
          ))}
        </View>
        <Text style={{ fontSize: 11, marginTop: 10, color: c.ardoise, textAlign: "center" }}>
          Pas besoin de compte. Vous pouvez rester anonyme. Signaler un presque-accident, c&apos;est éviter le prochain accident.
        </Text>
        <View style={{ marginTop: 24, borderWidth: 2, borderColor: c.rouge, padding: 10, width: 400 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 14, color: c.rouge, textAlign: "center" }}>
            Blessé grave : appelez d&apos;abord le 112 et prévenez un sauveteur secouriste.
          </Text>
        </View>
        <View style={{ position: "absolute", bottom: 28, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 7, color: c.gris, maxWidth: 420 }}>{lien}</Text>
          <LogoDocument marque={marque} hauteur={24} />
        </View>
        <MentionFrisk marque={marque} />
      </Page>
    </Document>
  );
}
