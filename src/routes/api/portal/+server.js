import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/db.js';

export async function GET({ url, cookies }) {
  try {
    const customerId = cookies.get('portal_customer_id');
    const eventId = url.searchParams.get('eventId');

    if (!customerId || !eventId) {
      return json({ error: 'Unauthorized or missing event context' }, { status: 401 });
    }

    // 1. Fetch event menus
    const menuRes = await pool.query(
      `SELECT m.id, m.name, m.category, m.price_per_serving, em.quantity_planned 
       FROM event_menus em
       JOIN menus m ON em.menu_id = m.id
       WHERE em.event_id = $1`,
      [parseInt(eventId)]
    );

    // 2. Fetch contract & signatures
    let contract = null;
    let signature = null;
    const contractRes = await pool.query(
      `SELECT * FROM contracts WHERE event_id = $1`,
      [parseInt(eventId)]
    );

    if (contractRes.rows.length > 0) {
      contract = contractRes.rows[0];
      const sigRes = await pool.query(
        `SELECT * FROM contract_signatures WHERE contract_id = $1 ORDER BY signed_at DESC LIMIT 1`,
        [contract.id]
      );
      if (sigRes.rows.length > 0) {
        signature = sigRes.rows[0];
      }
    } else {
      // Create a default contract template if not exists
      const eventDetailsRes = await pool.query(
        `SELECT e.*, c.name AS customer_name FROM events e JOIN customers c ON e.customer_id = c.id WHERE e.id = $1`,
        [parseInt(eventId)]
      );
      if (eventDetailsRes.rows.length > 0) {
        const ev = eventDetailsRes.rows[0];
        const defaultText = `CATERING SERVICE AGREEMENT\n\nClient Name: ${ev.customer_name}\nEvent Type: ${ev.event_type}\nDate: ${ev.event_date.toDateString ? ev.event_date.toDateString() : new Date(ev.event_date).toLocaleDateString()}\nGuest Count: ${ev.guest_count} guests\nBudget: ₱${parseFloat(ev.budget).toLocaleString()}\nTheme: ${ev.theme}\nVenue: ${ev.venue_type}\n\nTERMS & CONDITIONS:\n1. The client agrees to pay a 50% non-refundable deposit.\n2. Final headcount must be confirmed 7 days prior to the event.\n3. The caterer reserves the right to make ingredient substitutions in case of market shortages.`;
        
        const newContract = await pool.query(
          `INSERT INTO contracts (event_id, content, status) VALUES ($1, $2, 'Draft') RETURNING *`,
          [parseInt(eventId), defaultText]
        );
        contract = newContract.rows[0];
      }
    }

    // 3. Fetch Invoices and Payments
    let invoice = null;
    let payments = [];
    const invoiceRes = await pool.query(
      `SELECT * FROM invoices WHERE event_id = $1`,
      [parseInt(eventId)]
    );

    if (invoiceRes.rows.length > 0) {
      invoice = invoiceRes.rows[0];
      const payRes = await pool.query(
        `SELECT * FROM payments WHERE invoice_id = $1`,
        [invoice.id]
      );
      payments = payRes.rows;
    } else {
      // Auto-generate invoice based on budget
      const evDetails = await pool.query(`SELECT budget FROM events WHERE id = $1`, [parseInt(eventId)]);
      if (evDetails.rows.length > 0) {
        const budget = parseFloat(evDetails.rows[0].budget);
        const invNum = `INV-${eventId}-${Date.now().toString().slice(-4)}`;
        const tax = budget * 0.12;
        const netTotal = budget + tax;
        
        const newInvoice = await pool.query(
          `INSERT INTO invoices (event_id, invoice_number, total_amount, tax_amount, status) 
           VALUES ($1, $2, $3, $4, 'Unpaid') RETURNING *`,
          [parseInt(eventId), invNum, netTotal, tax]
        );
        invoice = newInvoice.rows[0];
      }
    }

    // 4. Fetch Review feedback if exists
    let review = null;
    const reviewRes = await pool.query(
      `SELECT * FROM reviews WHERE event_id = $1`,
      [parseInt(eventId)]
    );
    if (reviewRes.rows.length > 0) {
      review = reviewRes.rows[0];
    }

    return json({
      menus: menuRes.rows,
      contract,
      signature,
      invoice,
      payments,
      review
    });
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
}

export async function POST({ request, cookies }) {
  try {
    const customerId = cookies.get('portal_customer_id');
    if (!customerId) {
      return json({ error: 'Unauthorized session' }, { status: 401 });
    }

    const { action, eventId, contractId, signerName, signatureSvg, ipAddress, rating, comments } = await request.json();

    if (action === 'sign') {
      if (!contractId || !signerName || !signatureSvg) {
        return json({ error: 'Missing signature parameters' }, { status: 400 });
      }

      // Add signature record
      const sigResult = await pool.query(
        `INSERT INTO contract_signatures (contract_id, signer_name, signature_svg, ip_address)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [parseInt(contractId), signerName.trim(), signatureSvg, ipAddress || '127.0.0.1']
      );

      // Update contract status to Signed
      await pool.query(
        `UPDATE contracts SET status = 'Signed' WHERE id = $1`,
        [parseInt(contractId)]
      );

      return json({ success: true, signature: sigResult.rows[0] });
    }

    if (action === 'review') {
      if (!eventId || !rating) {
        return json({ error: 'Rating is required' }, { status: 400 });
      }

      // Insert review
      const revResult = await pool.query(
        `INSERT INTO reviews (event_id, rating, comments)
         VALUES ($1, $2, $3)
         ON CONFLICT (event_id) DO UPDATE SET rating = $2, comments = $3
         RETURNING *`,
        [parseInt(eventId), parseInt(rating), comments ? comments.trim() : '']
      );

      return json({ success: true, review: revResult.rows[0] });
    }

    return json({ error: 'Invalid portal action' }, { status: 400 });
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
}
