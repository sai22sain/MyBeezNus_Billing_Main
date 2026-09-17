const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { requireAuth, listUserRows } = require('../lib/tenant');
const { getAdminClient } = require('../lib/supabase');
const reportController = require('../controllers/reportController');

// Every report, including the legacy-compatible endpoints below, is scoped
// to the authenticated user's records.
router.use(requireAuth);

// Legacy SQLite-backed report endpoints (unused by the current Supabase frontend).
router.get('/dashboard', reportController.getDashboardStats);
router.get('/daily', reportController.getDailyRevenue);
router.get('/monthly', reportController.getMonthlyRevenue);
router.get('/top-services', reportController.getTopServices);
router.get('/repeat-customers', reportController.getRepeatCustomers);

/**
 * GET /api/reports/export?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * Supabase (service-role) Excel revenue report for the authenticated user only.
 */
router.get('/export', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const client = getAdminClient();
    const rows = await listUserRows({
      supabase: client,
      uid: req.user.uid,
      table: 'bills',
      columns: 'bill_number,created_at,customer_name,customer_mobile,total_amount,discount,tax,final_amount,payment_mode',
      options: {
        fromDate: startDate,
        toDate: endDate + 'T23:59:59.999Z',
        orderBy: 'created_at',
        ascending: false,
      },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Revenue Report');
    worksheet.columns = [
      { header: 'Bill Number', key: 'bill_number', width: 15 },
      { header: 'Date', key: 'created_at', width: 20 },
      { header: 'Customer Name', key: 'customer_name', width: 25 },
      { header: 'Mobile', key: 'customer_mobile', width: 15 },
      { header: 'Subtotal', key: 'total_amount', width: 12 },
      { header: 'Discount', key: 'discount', width: 12 },
      { header: 'Tax', key: 'tax', width: 12 },
      { header: 'Final Amount', key: 'final_amount', width: 15 },
      { header: 'Payment Mode', key: 'payment_mode', width: 15 },
    ];
    worksheet.addRows(rows);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=revenue_report_' + startDate + '_' + endDate + '.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
