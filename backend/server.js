const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());


const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
});


pool.connect((err, client, release) => {
    if (err) {
        return console.error('Erreur de connexion PostgreSQL:', err.stack);
    }
    console.log(' Succès : Le backend est connecté à PostgreSQL !');
    release();
});

// Route pour enregistrer une nouvelle agence
app.post('/api/inscription', async (req, res) => {
    try {
        const { nom_complet, email, mot_de_passe, nom_agence } = req.body;

        // 1. Insérer l'utilisateur (on récupère son ID)
        const nouvelUtilisateur = await pool.query(
            "INSERT INTO utilisateurs (nom_complet, email, mot_de_passe, role) VALUES ($1, $2, $3, 'agence') RETURNING id",
            [nom_complet, email, mot_de_passe]
        );

        const utilisateurId = nouvelUtilisateur.rows[0].id;

        // 2. Créer le profil de l'agence liée à cet utilisateur
        await pool.query(
            "INSERT INTO agences (utilisateur_id, nom_agence) VALUES ($1, $2)",
            [utilisateurId, nom_agence]
        );

        res.status(201).json({ message: "Compte agence créé avec succès !" });
    } catch (err) {
        console.error("Erreur serveur :", err.message);
        res.status(500).json({ error: "L'inscription a échoué. L'email existe peut-être déjà." });
    }
});

// Route pour la Connexion (Login)
app.post('/api/login', async (req, res) => {
    try {
        const { email, mot_de_passe } = req.body;

        
        const utilisateur = await pool.query(
            "SELECT * FROM utilisateurs WHERE email = $1 AND mot_de_passe = $2",
            [email, mot_de_passe]
        );

        if (utilisateur.rows.length > 0) {
            res.json({ 
                message: "Connexion réussie", 
                user: utilisateur.rows[0] 
            });
        } else {
            res.status(401).json({ error: "Email ou mot de passe incorrect" });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Erreur serveur lors de la connexion" });
    }
});

// --- ROUTE CORRIGÉE ICI ---
app.post('/api/creer-contrat', async (req, res) => {
    try {
        const { 
            souscripteur_nom, passport_numero, date_effet, 
            date_echeance, destination, statut_police, 
            agence_id, produit_id 
        } = req.body;

        // J'ai remplacé les "..." par la vraie requête SQL ci-dessous
        const result = await pool.query(
            `INSERT INTO polices_assurance 
            (souscripteur_nom, passeport_numero, date_effet, date_echeance, destination, statut_police, agence_id, produit_id, cree_le) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) 
            RETURNING id, numero_police`,
            [souscripteur_nom, passport_numero, date_effet, date_echeance, destination, statut_police, agence_id, produit_id]
        );

        res.status(201).json({ 
            id: result.rows[0].id, 
            numero_police: result.rows[0].numero_police 
        });
    } catch (err) {
        console.error("Erreur SQL Contrat:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/mes-contrats', async (req, res) => {
    try {
        // On récupère tout pour être sûr que le tableau se remplisse
        const result = await pool.query("SELECT * FROM polices_assurance ORDER BY cree_le DESC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route pour que Samba confirme la validité du dossier
app.patch('/api/confirm-samba/:sinistre_id', async (req, res) => {
    try {
        const { sinistre_id } = req.params;
        await pool.query("UPDATE sinistres SET confirmation_samba = TRUE WHERE id = $1", [sinistre_id]);
        res.json({ message: "Samba a confirmé le dossier. AFA peut maintenant traiter." });
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/declarer-sinistre', async (req, res) => {
    // On récupère les données envoyées par ton fetch
    const { numero_police, type, description } = req.body;

    try {
        // 1. On cherche l'ID du contrat (en ignorant les espaces et la casse)
        // TRIM enlève les espaces, ILIKE ignore les majuscules/minuscules
        // Remplace ta requête de recherche par celle-ci :
const queryContrat = `
    SELECT id, souscripteur_nom 
    FROM polices_assurance 
    WHERE REPLACE(UPPER(numero_police), ' ', '') = REPLACE(UPPER($1), ' ', '')
`;

// REPLACE(..., ' ', '') supprime tous les espaces pour la comparaison
const contrat = await pool.query(queryContrat, [numero_police]);
        // Si on ne trouve rien
        if (contrat.rows.length === 0) {
            console.log("Échec : Police non trouvée pour :", numero_police);
            return res.status(404).json({ error: "Police inconnue" });
        }

        const policeId = contrat.rows[0].id;
        const nomClient = contrat.rows[0].souscripteur_nom;

        // 2. On insère dans la table sinistres
        const querySinistre = `
            INSERT INTO sinistres (police_id, nom_client, type_incident, description, statut_afa) 
            VALUES ($1, $2, $3, $4, 'ATTENTE_AFA')
        `;
        await pool.query(querySinistre, [policeId, nomClient, type, description]);

        console.log(`Sinistre enregistré pour ${nomClient}`);
        res.json({ message: "Succès" });

    } catch (err) {
        console.error("Erreur SQL détaillée :", err.message);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// 1. L'AFA appelle cette route pour demander une confirmation à Samba
app.patch('/api/demander-confirmation/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("UPDATE sinistres SET statut_afa = 'ATTENTE_SAMBA' WHERE id = $1", [id]);
        res.json({ message: "Demande envoyée à Samba" });
    } catch (err) { res.status(500).send(err.message); }
});

// 2. Samba appelle cette route pour confirmer le dossier
app.patch('/api/valider-samba/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("UPDATE sinistres SET confirmation_samba = TRUE, statut_afa = 'CONFIRME_SAMBA' WHERE id = $1", [id]);
        res.json({ message: "Dossier confirmé par Samba" });
    } catch (err) { res.status(500).send(err.message); }
});

// --- NOUVELLE ROUTE : ENREGISTREMENT DU PAIEMENT ---
app.post('/api/valider-paiement', async (req, res) => {
    const client = await pool.connect(); 
    try {
        // On récupère les noms envoyés par le frontend
        const { id_contrat, montant, mode_paiement, ref_transaction } = req.body;

        await client.query('BEGIN'); 

        // 1. Insertion dans la table paiement avec VOS noms de colonnes exacts
        const insertPaiement = `
            INSERT INTO paiement (id_contrat, montant, mode_paiement, ref_transaction, statut_paiement, date_paiement) 
            VALUES ($1, $2, $3, $4, 'Succès', NOW()) RETURNING *`;
        
        const resPaiement = await client.query(insertPaiement, [id_contrat, montant, mode_paiement, ref_transaction]);

        // 2. Mettre à jour le statut de la police d'assurance
        const updatePolice = `
            UPDATE polices_assurance 
            SET statut_police = 'VALIDE' 
            WHERE id = $1`;
        await client.query(updatePolice, [id_contrat]);

        await client.query('COMMIT'); 

        res.status(201).json({ 
            message: "Paiement réussi et contrat activé", 
            paiement: resPaiement.rows[0] 
        });

    } catch (err) {
        await client.query('ROLLBACK'); 
        console.error("Erreur paiement :", err.message);
        res.status(500).json({ error: "Erreur SQL : " + err.message });
    } finally {
        client.release();
    }
});

// Route pour afficher les sinistres sur le portail AFA
app.get('/api/liste-sinistres', async (req, res) => {
    try {
        // On récupère tous les sinistres et on joint la table police pour avoir le numéro de police
        const result = await pool.query(`
            SELECT s.*, p.numero_police 
            FROM sinistres s
            JOIN polices_assurance p ON s.police_id = p.id
            ORDER BY s.cree_le DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Erreur récupération sinistres :", err.message);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

app.patch('/api/finaliser-sinistre/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { decision } = req.body; // 'APPROUVE' ou 'REJETE'
        
        await pool.query(
            "UPDATE sinistres SET statut_afa = $1 WHERE id = $2", 
            [decision, id]
        );
        
        res.json({ message: "Décision transmise au client" });
    } catch (err) { res.status(500).send(err.message); }
});

// Route pour que l'AFA dédommage le client
app.patch('/api/dedommager-client/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // On passe le statut à 'TERMINE' et on peut imaginer un montant
        await pool.query(
            "UPDATE sinistres SET statut_afa = 'DÉDOMMAGÉ', confirmation_samba = TRUE WHERE id = $1", 
            [id]
        );
        res.json({ message: "Le dédommagement a été envoyé au client !" });
    } catch (err) { res.status(500).send(err.message); }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(` Serveur Samba Voyage lancé sur http://localhost:${PORT}`);
});