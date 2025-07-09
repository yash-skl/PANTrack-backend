import express, { urlencoded } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import http from "http";
import setupSocketIO from "./socket.js";
import connectDB from "./db/index.js";

dotenv.config({
    path: "./.env"
});

const app = express();
const server = http.createServer(app);


const allowedOrigins = process.env.CLIENT_URL || "http://localhost:5173";
app.use(
    cors({
        origin: allowedOrigins,
        credentials: true, 
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"]
    })
);


app.use(express.json({ limit: "16kb" }));
app.use(urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// Setup Socket.IO
const io = setupSocketIO(server);

app.use((req, res, next) => {
    req.io = io;
    next();
});


import panRouter from "./routes/pan.routes.js";
import userRouter from "./routes/user.routes.js";
import adminRouter from "./routes/admin.routes.js";
import subAdminRouter from "./routes/subAdmin.routes.js";
import chatRouter from "./routes/chat.routes.js";


app.use("/api/v1/pan", panRouter);
app.use("/api/v1/user", userRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/subadmin", subAdminRouter);
app.use("/api/v1/chat", chatRouter);
 






connectDB()
    .then(() => {
        server.listen(process.env.PORT || 8000, () => {
            console.log(`Server is running on port: ${process.env.PORT || 8000}`);
        });
    })
    .catch((error) => {
        console.log("MongoDB Connection Failed: ", error);
    });

export { io };