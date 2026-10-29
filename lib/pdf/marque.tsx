// Logo de l'entreprise et mention de Frisk DU, communs à tous les documents PDF.

import { Image, Text, View } from "@react-pdf/renderer";
import { createContext } from "react";
import type { Marque } from "@/lib/identite";

// Couleur des titres de section (composant Section) : celle de l'entreprise, sinon noir.
export const CouleurTitres = createContext("#0c0b0a");

// Logo dans l'en-tête : le logo d'une entreprise est souvent plus large que haut.
export function LogoDocument({ marque, hauteur = 40, style }: { marque: Marque; hauteur?: number; style?: { marginLeft?: number } }) {
  return (
    // eslint-disable-next-line jsx-a11y/alt-text -- composant PDF, sans attribut alt
    <Image src={marque.logo} style={{ height: hauteur, maxWidth: hauteur * 3.5, objectFit: "contain", ...style }} />
  );
}

// « Réalisé avec Frisk DU », discret, en bas de chaque page.
export function MentionFrisk({ marque }: { marque: Marque }) {
  return (
    <View fixed style={{ position: "absolute", bottom: 7, left: 0, right: 0, flexDirection: "row", justifyContent: "center", alignItems: "center" }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- composant PDF, sans attribut alt */}
      <Image src={marque.frisk} style={{ width: 7, height: 7, marginRight: 3 }} />
      <Text style={{ fontSize: 6, color: "#8a837a" }}>Réalisé avec Frisk DU</Text>
    </View>
  );
}

// Filet à la couleur de l'entreprise en haut de chaque page (rien pour les documents Frisk).
export function BandeauCouleur({ marque }: { marque: Marque }) {
  if (!marque.bandeau) return null;
  return <View fixed style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8, backgroundColor: marque.bandeau }} />;
}
