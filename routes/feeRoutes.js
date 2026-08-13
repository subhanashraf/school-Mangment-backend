const express = require('express');
const router = express.Router();
const feeController = require('../controllers/feeController');
const { authenticate, authorize } = require('../middleware/auth');

// Get all standard fee structures
router.get('/structures', authenticate, feeController.getFeeStructures);

// Create or update standard fee structure
router.post('/structures', authenticate, authorize('admin'), feeController.setFeeStructure);

// Delete standard fee structure
router.delete('/structures/:standard', authenticate, authorize('admin'), feeController.deleteFeeStructure);

// Get student fees by standard
router.get('/students/:standard', authenticate, feeController.getStudentFeesByStandard);

// Toggle student quarter status
router.put('/students/:studentFeeId/toggle', authenticate, authorize('admin'), feeController.toggleQuarterPaymentStatus);

// Student get own fee record
router.get('/my-fee', authenticate, authorize('student'), feeController.getStudentOwnFee);

// Student pay quarter
router.post('/pay-quarter', authenticate, authorize('student'), feeController.payQuarterFee);

// Student pay full fee
router.post('/pay-full', authenticate, authorize('student'), feeController.payFullFee);

module.exports = router;
