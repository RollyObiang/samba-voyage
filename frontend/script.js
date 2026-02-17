document.getElementById('formInscription').addEventListener('submit', async (e) => {
    e.preventDefault(); // Empêche le rechargement de la page

    // 1. Récupération des données du formulaire
    const donnees = {
        nom_complet: document.getElementById('nom_complet').value,
        email: document.getElementById('email').value,
        mot_de_passe: document.getElementById('mot_de_passe').value,
        nom_agence: document.getElementById('nom_agence').value
    };

    try {
        // 2. Envoi au Backend (sur le port 3000 qu'on a configuré)
        const reponse = await fetch('http://localhost:3000/api/inscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(donnees)
        });

        const resultat = await reponse.json();

        if (reponse.ok) {
            alert(" " + resultat.message);
        } else {
            alert(" Erreur : " + resultat.error);
        }
    } catch (erreur) {
        console.error("Erreur de connexion :", erreur);
        alert("Le serveur backend ne répond pas. Vérifie qu'il est lancé !");
    }
});

// À ajouter dans ta route POST avant le res.status
console.log("Nouvel utilisateur créé avec l'ID :", utilisateurId);