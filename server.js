require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const helmet = require('helmet');
const connectDB = require('./config/database');

// Import routes
const authRoutes = require('./routes/authRoutes');
const schoolRoutes = require('./routes/schoolRoutes');
const studentRoutes = require('./routes/studentRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const classRoutes = require('./routes/classRoutes');
const subjectRoutes = require('./routes/subjectRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const marksRoutes = require('./routes/marksRoutes');
const noticeRoutes = require('./routes/noticeRoutes');
const homeworkRoutes = require('./routes/homeworkRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const eventRoutes = require('./routes/eventRoutes');
const messageRoutes = require('./routes/messageRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const fileProxyRoutes = require('./routes/fileProxyRoutes');
const timetableBuilderRoutes = require('./routes/timetableBuilder');
const academicYearRouter = require('./routes/academicYearRouter');

// Import middleware
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Initialize Express and Socket.io
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
].filter(Boolean);

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Fallback to accept other local variants if needed
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database Connection
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/academic', academicYearRouter);
app.use('/api/schools', schoolRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/timetables', timetableRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/marks', marksRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/homework', homeworkRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/fees', require('./routes/feeRoutes'));
app.use('/api/files', fileProxyRoutes);
app.use('/api/timetable-builder', timetableBuilderRoutes);

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running' });
});

// Socket.io Connection
const userSockets = new Map();

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // Store user socket mapping
  socket.on('user-connected', (userId) => {
    userSockets.set(userId, socket.id);
    io.emit('user-online', { userId });
  });

  // Real-time notifications
  socket.on('notify-all', (data) => {
    io.emit('notification', data);
  });

  socket.on('notify-user', (data) => {
    const userSocket = userSockets.get(data.userId);
    if (userSocket) {
      io.to(userSocket).emit('notification', data);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (let [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(userId);
        io.emit('user-offline', { userId });
        break;
      }
    }
  });
});

// Error Handling
app.use(notFound);
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Auto Notice Expiration Cleanup Task
  const Notice = require('./models/Notice');
  const { deleteCloudinaryFile } = require('./utils/cloudinaryHelper');

  const cleanupExpiredNotices = async () => {
    try {
      const expiredNotices = await Notice.find({ expiresAt: { $lte: new Date() } });
      if (expiredNotices.length > 0) {
        console.log(`Found ${expiredNotices.length} expired notices. Cleaning up...`);
        for (const notice of expiredNotices) {
          if (notice.attachments && notice.attachments.length > 0) {
            for (const url of notice.attachments) {
              if (url) await deleteCloudinaryFile(url);
            }
          }
          await Notice.findByIdAndDelete(notice._id);
          console.log(`Automatically deleted expired notice: ${notice.title}`);
        }
      }
    } catch (err) {
      console.error('Error in expired notice cleanup scheduler:', err);
    }
  };

  // Run immediately on boot, and then every hour
  cleanupExpiredNotices();
  setInterval(cleanupExpiredNotices, 60 * 60 * 1000);
});

// Handle Unhandled Rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

module.exports = app;
// Reload trigger

