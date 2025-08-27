const express = require("express");
const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { admin, db } = require("./Firebase/admin");
const app = express();
require("dotenv").config();

app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage });

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const database = admin.firestore();

// Ruta para agregar un documento de proyectos con imagenes en Firebase
app.post("/agregarDocumentoProyectos", upload.array("imagenes"), async (req, res) => {
    try {
        const { Empresa, Cargo, Actividades, Lugar, Obra, Fecha_Inicio, Fecha_Fin } = req.body;
        let obrasArray;
        try {
            obrasArray = JSON.parse(Obra);
        } catch (error) {
            obrasArray = Array.isArray(Obra) ? Obra : [];
        }
        let imageData = [];
        if ( req.files && req.files.length > 0 ) {
            imageData = await Promise.all(
                req.files.map(( file ) => {
                    return new Promise((resolve, reject) => {
                        const stream = cloudinary.uploader.upload_stream(
                            { folder : "portafoliojm/proyectos" },
                            ( error, uploadedImage ) => {
                                if ( error ) reject(error);
                                resolve({
                                    url: uploadedImage.secure_url,
                                    id: uploadedImage.public_id,
                                });
                            }
                        )
                        stream.end(file.buffer);
                    })
                })
            )
        }
        const docRef = await database.collection("proyectos").add({
            Empresa,
            Cargo,
            Actividades,
            Lugar,
            Obra: obrasArray,
            Imagen: imageData,
            Fecha_Inicio,
            Fecha_Fin,
        });
        res.status(201).json({ message: "Documento agregado", id: docRef.id });

    } catch (error) {
        res.status(500).json({ message: "Error al agregar el documento", error: error.message });
    }
});

// Ruta para editar un documento de proyectos con imagen en Firebase
app.put("/editarDocumentoProyectos", upload.array("imagenes"), async (req, res) => {
    try {
        const { id, Empresa, Cargo, Actividades, Lugar, Obra, Imagen, Fecha_Inicio, Fecha_Fin, eliminarImagen } = req.body;
        let obrasArray;
        try {
            obrasArray = JSON.parse(Obra);
        } catch (error) {
            obrasArray = Array.isArray(Obra) ? Obra : [];
        }
        
        const docRef = database.collection("proyectos").doc(id);
        const docSnap = await docRef.get();
        if (!docSnap.exists) res.status(404).json({ message: "No se encontro el documento" });

        let proyecto = docSnap.data();
        let imagenesActuales = proyecto.Imagen || [];

        // Eliminar imagen
        if ( eliminarImagen ) {
            let ids_a_eliminar;
            try {
                ids_a_eliminar = JSON.parse(eliminarImagen);
            } catch (error) {
                ids_a_eliminar = Array.isArray(eliminarImagen) ? eliminarImagen : [eliminarImagen];
            }

            for ( let public_id of ids_a_eliminar ) {
                await cloudinary.uploader.destroy(public_id);
            }
            imagenesActuales = imagenesActuales.filter(imagen => !ids_a_eliminar.includes(imagen.id));
        }

        // Subir nuevas imagenes en caso que el usuario quiera o necesite subir una nueva imagen
        if ( req.files && req.files.length > 0 ) {
            const nuevasImagenes = await Promise.all(
                req.files.map(( file ) => {
                    return new Promise((resolve, reject) => {
                        const stream = cloudinary.uploader.upload_stream(
                            { folder : "portafoliojm/proyectos" },
                            ( error, uploadedImage ) => {
                                if ( error ) reject(error);
                                resolve({
                                    url: uploadedImage.secure_url,
                                    id: uploadedImage.public_id,
                                });
                            }
                        )
                        stream.end(file.buffer);
                    })
                })
            )
            imagenesActuales = imagenesActuales.concat(nuevasImagenes);
        }

        const updateData = {}
        if ( Empresa !== undefined ) updateData.Empresa = Empresa;
        if ( Cargo !== undefined ) updateData.Cargo = Cargo;
        if ( Actividades !== undefined ) updateData.Actividades = Actividades;
        if ( Lugar !== undefined ) updateData.Lugar = Lugar;
        if ( Obra !== undefined ) updateData.Obra = obrasArray.map(obra => obra.id);
        if ( Fecha_Inicio !== undefined ) updateData.Fecha_Inicio = Fecha_Inicio.toDate();
        if ( Fecha_Fin !== undefined ) updateData.Fecha_Fin = Fecha_Fin.toDate();
        updateData.Imagen = imagenesActuales;

        await docRef.update(updateData);
        res.status(200).json({ message: "Documento editado", id: id });
    } catch (error) {
        res.status(500).json({ message: "Error al editar el documento", error: error.message });
    }
});

// Ruta para agregar documentos de cursos con imagen en Firebase
app.post("/agregarDocumentoCursos", upload.single("imagen"), async (req, res) => {
    try {
        const { Curso , Imagen} = req.body;
        if (!Curso) res.status(400).json({ message: "El campo Curso es obligatorio" });

        let imageUrl = Imagen || "";
        if ( req.file ) {
            const buffer = req.file.buffer;
            const result = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder : "portafoliojm/cursos" },
                    ( error, uploadedImage ) => {
                        if ( error ) reject(error);
                        resolve(uploadedImage);
                    }
                )
                stream.end(buffer);
            })
            imageUrl = result.secure_url[0];
        }

        const docRef = await database.collection("cursos").add({
            curso: Curso,
            Imagen: imageUrl,
            guardado: new Date(),
        });
        res.status(201).json({ message: "Documento agregado", id: docRef.id, curso: { curso: Curso, Imagen: imageUrl }});
    } catch (error) {
        res.status(500).json({ message: "Error al agregar el documento", error: error.message });
    }
});

// Ruta para obtener la informacion personal de la base de datos
app.get("/obtenerPersonalInfo", async (req, res) => {
    try {
        const snapshot = await database.collection("personal_info").get();
        const persona = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(persona);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener la informacion personal", error: error.message });
    }
});

// Ruta para editar la informacion personal de la base de datos
app.put("/editarPersonalInfo", async (req, res) => {
    try{
        const { id, direccion, telefono, email, descripcion } = req.body;
        if (!id) res.status(400).json({ message: "El campo id es obligatorio" });

        const updateData = {}
        if ( direccion !== undefined ) updateData.direccion = direccion;
        if ( telefono !== undefined ) updateData.telefono = telefono;
        if ( email !== undefined ) updateData.email = email;
        if ( descripcion !== undefined ) updateData.descripcion = descripcion;

        await database.collection("personal_info").doc(id).update({...updateData});
        res.status(200).json({ message: "Informacion personal editada" });
    } catch (error) {
        res.status(500).json({ message: "Error al editar la informacion personal", error: error.message });
    }
});

// Ruta para obtener todos los documentos de cursos
app.get("/obtenerDocumentosCursos", async (req, res) => {
    try {
        const snapshot = await database.collection("cursos").get();
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(docs);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener los documentos", error: error.message });
    }
});

// Ruta para obtener todos los documentos educacion
app.get("/obtenerDocumentosEducacion", async (req, res) => {
    try {
        const snapshot = await database.collection("educacion").get();
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(docs);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener los documentos", error: error.message });
    }
});

// Ruta para obtener todos los documentos de proyectos
app.get("/obtenerDocumentosProyectos", async (req, res) => {
    try {
        const snapshot = await database.collection("proyectos").get();
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(docs);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener los documentos", error: error.message });
    }
});

app.listen(process.env.PORT || 3000, () => {
    console.log("Server is running on port" + process.env.PORT);
});

// Ruta para verificar que el backend este funcionando
app.get("/verificar", (req, res) => {
    res.status(200).json({ message: "Backend funcionando" });
});