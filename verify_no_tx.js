
async function verifyNoTransactions() {
    const payload = {
        "nombre": "Manuel Belgrano",
        "cuilCuit": "12125556791", // Changed again to avoid unique constraint
        "emails": [
            { "direccion": "mb4@email.com" },
            { "direccion": "mb4@example.com" }
        ],
        "telefonos": [
            { "numero": "1112551234" },
            { "numero": "1112551235" }
        ],
        "esCentroMedico": false,
        "especialidades": [
            "695b4f2059a7449bf418d09b",
            "695b4f2059a7449bf418d09d"
        ],
        "centrosDeAtencion": [
            {
                "direccion": {
                    "calle": "Avenida San Martin",
                    "altura": 9616,
                    "codigoPostal": "B1746",
                    "localidad": "Francisco Alvarez",
                    "provincia": "Buenos Aires"
                },
                "horario": {
                    "duracionTurno": 15,
                    "dias": {
                        "Lunes": {
                            "atiende": true,
                            "bloques": [{
                                "horaInicio": "08:00",
                                "horaFin": "12:00"
                            }]
                        },
                        "Martes": {
                            "atiende": true,
                            "bloques": [
                                {
                                    "horaInicio": "08:00",
                                    "horaFin": "12:00"
                                },
                                {
                                    "horaInicio": "14:00",
                                    "horaFin": "18:00"
                                }
                            ]
                        }
                    }
                }
            }
        ]
    };

    try {
        const specResponse = await fetch('http://localhost:3002/especialidades');
        const specs = await specResponse.json();
        if (specs && specs.length > 0) {
            payload.especialidades = specs.slice(0, 2).map(s => s._id);
        }

        const response = await fetch('http://localhost:3002/prestadores', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('Response Status:', response.status);
        console.log('Response Data:', JSON.stringify(data, null, 2));

        if (response.status === 201) {
            console.log('SUCCESS: Prestador created successfully without transactions!');
        } else {
            console.error('FAILED: Could not create prestador.');
        }
    } catch (error) {
        console.error('Error during verification:', error);
    }
}

verifyNoTransactions();
