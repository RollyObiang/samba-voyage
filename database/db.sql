
CREATE TABLE utilisateurs (
    id SERIAL PRIMARY KEY,
    nom_complet VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    mot_de_passe TEXT NOT NULL,
    role VARCHAR(20) CHECK (role IN ('admin', 'agence', 'auditeur', 'client')),
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE agences (
    id SERIAL PRIMARY KEY,
    utilisateur_id INT REFERENCES utilisateurs(id) ON DELETE CASCADE,
    nom_agence VARCHAR(150) NOT NULL,
    code_agent VARCHAR(50) UNIQUE,
    adresse_ville VARCHAR(255),
    telephone VARCHAR(50),
    statut_contrat BOOLEAN DEFAULT FALSE
);


CREATE TABLE produits_assurance (
    id SERIAL PRIMARY KEY,
    nom_produit VARCHAR(100) NOT NULL, 
    zone_couverture VARCHAR(100),
    plafond_garantie DECIMAL(15, 2),
    description_garanties TEXT
);


CREATE TABLE polices_assurance (
    id SERIAL PRIMARY KEY,
    numero_police VARCHAR(50) UNIQUE NOT NULL,
    souscripteur_nom VARCHAR(150) NOT NULL,
    passeport_numero VARCHAR(50),
    date_effet DATE NOT NULL,
    date_echeance DATE NOT NULL,
    destination VARCHAR(100),
    statut_police VARCHAR(20) DEFAULT 'En attente', 
    agence_id INT REFERENCES agences(id),
    produit_id INT REFERENCES produits_assurance(id),
    cree_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE paiements (
    id SERIAL PRIMARY KEY,
    police_id INT REFERENCES polices_assurance(id),
    montant_ttc DECIMAL(10, 2) NOT NULL,
    methode_paiement VARCHAR(50), 
    reference_transaction VARCHAR(100),
    date_paiement TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


INSERT INTO produits_assurance (nom_produit, zone_couverture, plafond_garantie) 
VALUES ('SAMBA VOYAGE MONDE', 'Toutes zones', 20000000.00);