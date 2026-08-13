const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema(
  {
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    schoolCode: {
      type: String,
      default: '',
    },
    schoolName: {
      type: String,
      default: '',
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    phone: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ['teacher'],
      default: 'teacher',
      required: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: Date,
    refreshTokens: [
      {
        token: String,
        createdAt: {
          type: Date,
          default: Date.now,
          expires: 2592000, // 30 days
        },
      },
    ],
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,

    // --- Teacher Specific Detailed Fields ---

    // 1. Basic Information
    teacherId: {
      type: String,
      default: () => 'TCH' + Math.floor(100000 + Math.random() * 900000), // Auto generated Teacher ID
    },
    employeeId: {
      type: String,
      unique: true,
      sparse: true,
    },
    staffCode: {
      type: String,
      default: null,
    },
    firstName: {
      type: String,
      default: '',
    },
    middleName: {
      type: String,
      default: '',
    },
    lastName: {
      type: String,
      default: '',
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other'],
      default: 'Male',
    },
    dateOfBirth: Date,
    bloodGroup: String,
    aadhaarNumber: {
      type: String,
      default: '',
    },
    panNumber: {
      type: String,
      default: '',
    },
    nationality: {
      type: String,
      default: 'Indian',
    },
    maritalStatus: {
      type: String,
      enum: ['Single', 'Married', 'Divorced', 'Widowed'],
      default: 'Single',
    },

    // 2. Contact Information
    alternateMobileNumber: String,
    emergencyContactNumber: String,
    currentAddress: String,
    permanentAddress: String,
    city: String,
    state: String,
    country: {
      type: String,
      default: 'India',
    },
    pinCode: String,

    // 3. Professional Information
    designation: String,
    department: String,
    joiningDate: Date,
    employmentType: {
      type: String,
      enum: ['Full-Time', 'Part-Time', 'Contract'],
      default: 'Full-Time',
    },
    experience: {
      type: Number, // Years
      default: 0,
    },
    previousSchool: String,
    employeeStatus: {
      type: String,
      enum: ['Active', 'On Leave', 'Resigned', 'Retired'],
      default: 'Active',
    },
    reportingTo: String, // Principal or HOD name/role

    // 4. Academic Qualifications
    qualifications: [
      {
        degree: {
          type: String,
          enum: ['B.Ed', 'M.Ed', 'B.Sc', 'M.Sc', 'B.Tech', 'M.Tech', 'PhD', 'Other'],
        },
        university: String,
        year: String,
        percentageCGPA: String,
      }
    ],

    // 8. Leave Management (Subdocument logs)
    leaves: [
      {
        leaveType: String,
        startDate: Date,
        endDate: Date,
        numberOfDays: Number,
        reason: String,
        supportingDocument: String, // URL
        approvalStatus: {
          type: String,
          enum: ['Pending', 'Approved', 'Rejected'],
          default: 'Pending',
        },
        approvedBy: String,
      }
    ],

    // 9. Salary / Payroll
    salaryDetails: {
      basicSalary: { type: Number, default: 0 },
      hra: { type: Number, default: 0 },
      da: { type: Number, default: 0 },
      otherAllowances: { type: Number, default: 0 },
      deductions: { type: Number, default: 0 },
      pf: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      netSalary: { type: Number, default: 0 },
      salarySlip: String, // URL
      paymentDate: Date,
      bankName: String,
      accountNumber: String,
      ifscCode: String,
    },

    // 10. Subjects
    subjectIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
      },
    ],
    classIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
      },
    ],
    assignedSubjectStandards: [
      {
        subjectId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Subject',
        },
        standards: [String],
      },
    ],
    subjectClassAssignments: [
      {
        subjectId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Subject',
        },
        classId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Class',
        },
      },
    ],

    // 11. Class Teacher Details
    isClassTeacher: {
      type: Boolean,
      default: false,
    },
    classTeacherOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
    },

    // 13. Documents (Upload URLs)
    documents: {
      aadhaarCard: String,
      panCard: String,
      degreeCertificates: String,
      experienceCertificates: String,
      resume: String,
      passportPhoto: String,
      bankPassbook: String,
      joiningLetter: String,
    },

    // 14. Login Details
    username: String,
    accountStatus: {
      type: String,
      enum: ['Active', 'Suspended', 'Inactive'],
      default: 'Active',
    },

    // 17. System Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'createdByModel',
    },
    createdByModel: {
      type: String,
      enum: ['User'],
      default: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'updatedByModel',
    },
    updatedByModel: {
      type: String,
      enum: ['User'],
      default: 'User',
    },
    softDelete: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Clean up empty string values for ObjectIds before validation
teacherSchema.pre('validate', function (next) {
  if (this.classTeacherOf === '' || !this.isClassTeacher) {
    this.classTeacherOf = undefined;
  }
  next();
});

// Compound unique index: email + schoolId
teacherSchema.index({ email: 1, schoolId: 1 }, { unique: true });

module.exports = mongoose.model('Teacher', teacherSchema);
