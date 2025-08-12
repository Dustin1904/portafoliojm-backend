import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import admin from "firebase-admin";
import path from "path";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

// Configuracion de Multer (memoria temporal)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Ruta para subir imagen a cloudinary
app.post("/upload", upload.single("image"), async (req, res) => {
    try {
        const result = await cloudinary.uploader.upload_stream(
            { folder: "images" },
            (error , uploadedImage) => {
                if (error) return res.status(500).json({ error });
                res.json({ url: uploadedImage.secure_url });
            }
        )
        result.end(req.file.buffer);
    } catch (error) {
        res.status(500).json({ error: "Error al subir la imagen" });
    }
});

// Ruta para obtener las imagenes de la base de datos
app.get("/images", async (req, res) => {
    try {
        const images = await db.collection("images").get();
        const imagesData = images.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
        res.json(imagesData);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener las imagenes" });
    }
});

// Ruta para guardar datos en Firebase
app.post("/save-data", async (req, res) => {
    try {
        const { name, imageUrl } = req.body;
        await db.collection("images").add({
            name,
            imageUrl,
        });
        res.json({ message: "Datos guardados correctamente" });
    } catch (error) {
        res.status(500).json({ error: "Error al guardar los datos" });
    }
});

app.listen(process.env.PORT, () => console.log(`Server is running on port ${process.env.PORT}`));