// ============================================
// 🌿 Pl@ntNet API Integration
// ============================================

const PlantNetAPI = {
    BASE_URL: 'https://my-api.plantnet.org/v2/identify/all',

    getApiKey() {
        return localStorage.getItem('plantnet_api_key') || '';
    },

    setApiKey(key) {
        localStorage.setItem('plantnet_api_key', key);
    },

    // Bild komprimieren vor dem Upload
    async compressImage(file, maxWidth = 1024) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, maxWidth / img.width);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(
                    (blob) => resolve(blob),
                    'image/jpeg',
                    0.8
                );
            };
            img.src = URL.createObjectURL(file);
        });
    },

    // Base64 aus Datei lesen (für Vorschau)
    async fileToBase64(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
    },

    // Pflanze erkennen via Pl@ntNet
    async identify(imageFile) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error('NO_API_KEY');
        }

        // Bild komprimieren
        const compressed = await this.compressImage(imageFile);

        // FormData für Pl@ntNet API
        const formData = new FormData();
        formData.append('images', compressed, 'plant.jpg');
        formData.append('organs', 'auto');

        const url = `${this.BASE_URL}?include-related-images=false&no-reject=false&nb-results=5&lang=de&api-key=${encodeURIComponent(apiKey)}`;

        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            if (response.status === 401) throw new Error('INVALID_API_KEY');
            if (response.status === 429) throw new Error('RATE_LIMIT');
            throw new Error('API_ERROR');
        }

        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            throw new Error('NOT_RECOGNIZED');
        }

        // Bestes Ergebnis zurückgeben
        const best = data.results[0];
        return {
            name_de: best.species?.commonNames?.[0] || best.species?.scientificNameWithoutAuthor || 'Unbekannt',
            name_lat: best.species?.scientificNameWithoutAuthor || '',
            family: best.species?.family?.scientificNameWithoutAuthor || '',
            confidence: Math.round((best.score || 0) * 100),
            all_results: data.results.slice(0, 5).map(r => ({
                name: r.species?.commonNames?.[0] || r.species?.scientificNameWithoutAuthor,
                name_lat: r.species?.scientificNameWithoutAuthor,
                confidence: Math.round((r.score || 0) * 100)
            }))
        };
    }
};
