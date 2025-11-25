import asyncHandler from 'express-async-handler';
import Order from '../models/orderModel.js';
import fetch from 'node-fetch';
import sendEmail from '../utils/sendEmail.js';

import Product from '../models/productModel.js';

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const addOrderItems = asyncHandler(async (req, res) => {
  const {
    orderItems,
    shippingAddress,
    paymentMethod,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
  } = req.body;

  if (orderItems && orderItems.length === 0) {
    res.status(400);
    throw new Error('No order items');
    return;
  } else {
    // 1. Check Stock & Decrement
    for (const item of orderItems) {
      const product = await Product.findById(item.product);
      if (!product) {
        res.status(404);
        throw new Error(`Product not found: ${item.name}`);
      }
      if (product.countInStock < item.quantity) {
        res.status(400);
        throw new Error(`Not enough stock for ${item.name}`);
      }
      product.countInStock -= item.quantity;
      await product.save();
    }

    // 2. Create Order
    const order = new Order({
      orderItems,
      user: req.user._id,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
    });

    const createdOrder = await order.save();
    res.status(201).json(createdOrder);
  }
});

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate(
    'user',
    'name email'
  );

  if (order) {
    res.json(order);
  } else {
    res.status(404);
    throw new Error('Order not found');
  }
});

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id });
  res.json(orders);
});

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({}).populate('user', 'id name');
  res.json(orders);
});

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');

  if (order) {
    order.status = req.body.status || order.status;

    if (req.body.status === 'Delivered') {
      order.isDelivered = true;
      order.deliveredAt = Date.now();
    }

    const updatedOrder = await order.save();

    // Send Status Update Email
    try {
      const message = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #fce4ec; border-radius: 15px; overflow: hidden;">
          <div style="background-color: #fff0f5; padding: 30px; text-align: center;">
            <h2 style="color: #d63384; margin: 0; font-family: 'Playfair Display', serif;">Order Status Update</h2>
          </div>
          <div style="padding: 30px;">
            <p>Hello <strong>${order.user.name}</strong>,</p>
            <p>We have an update regarding your order <strong>#${order._id}</strong>.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <p style="font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #999; margin-bottom: 10px;">Current Status</p>
              <h3 style="background: #d63384; display: inline-block; padding: 15px 30px; border-radius: 50px; color: #fff; margin: 0; font-weight: 500; box-shadow: 0 4px 15px rgba(214, 51, 132, 0.2);">${order.status}</h3>
            </div>

            ${order.status === 'Shipped' ? `
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                <p style="margin: 0; text-align: center;">Your items are on their way! You can track the progress in your dashboard.</p>
              </div>
            ` : ''}

            ${order.status === 'Ready for Pickup' ? `
              <div style="background-color: #e3f2fd; padding: 20px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #bbdefb;">
                <h4 style="color: #1976d2; margin-top: 0; text-align: center;">Good News!</h4>
                <p style="margin: 0; text-align: center; color: #0d47a1;">Your order has arrived at the nearest <strong>GIG Logistics</strong> center.</p>
                <p style="margin-top: 10px; text-align: center; font-weight: bold;">It is now ready for pickup!</p>
                <p style="margin-top: 10px; text-align: center; font-size: 13px; color: #555;">Please bring a valid ID and your Order ID when you go to collect your package.</p>
              </div>
            ` : ''}
            
            ${order.status === 'Delivered' ? `
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                <p style="margin: 0; text-align: center;">Your package has been delivered. We hope you enjoy your JAANMAK products!</p>
              </div>
            ` : ''}

            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" style="background-color: #333; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 14px;">View Order Details</a>
            </div>
          </div>
          <div style="background-color: #fafafa; padding: 20px; text-align: center; font-size: 12px; color: #999;">
            <p>&copy; ${new Date().getFullYear()} JAANMAK. All rights reserved.</p>
          </div>
        </div>
      `;

      await sendEmail({
        to: order.user.email,
        bcc: process.env.JAANMAK_EMAIL || process.env.EMAIL_USER,
        subject: `Update: Your Order is ${order.status} - #${order._id}`,
        html: message
      });
    } catch (error) {
      console.error("Failed to send status update email", error);
    }

    res.json(updatedOrder);
  } else {
    res.status(404);
    throw new Error('Order not found');
  }
});

// @desc    Verify Paystack Payment
// @route   PUT /api/orders/:id/pay
// @access  Private
const verifyOrderPayment = asyncHandler(async (req, res) => {
  const { reference } = req.body;
  const order = await Order.findById(req.params.id).populate('user', 'name email');

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  try {
    // Verify with Paystack API
    console.log(`Verifying payment for reference: ${reference}`);
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    console.log('Paystack Verification Response:', JSON.stringify(data, null, 2));

    if (data.status && data.data.status === 'success') {
      // Verification Successful
      order.isPaid = true;
      order.paidAt = Date.now();
      order.paymentResult = {
        id: data.data.reference,
        status: data.data.status,
        email_address: data.data.customer.email,
      };

      // Initial status after payment
      order.status = 'Processing';

      const updatedOrder = await order.save();

      // Send Confirmation Email
      try {
        const message = `
          <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #fce4ec; border-radius: 15px; overflow: hidden;">
            <div style="background-color: #fff0f5; padding: 30px; text-align: center;">
              <h2 style="color: #d63384; margin: 0; font-family: 'Playfair Display', serif;">Order Confirmed!</h2>
            </div>
            <div style="padding: 30px;">
              <p>Hello <strong>${order.user.name}</strong>,</p>
              <p>Thank you for your purchase. We have received your payment and are processing your order.</p>
              
              <div style="background: #fff; padding: 25px; border-radius: 15px; margin: 25px 0; border: 1px solid #fce4ec; box-shadow: 0 2px 10px rgba(0,0,0,0.02);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                  <span style="color: #999;">Order ID</span>
                  <span style="font-weight: bold;">#${order._id}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                  <span style="color: #999;">Amount Paid</span>
                  <span style="font-weight: bold; color: #d63384;">₦${order.totalPrice.toLocaleString()}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #999;">Delivery Method</span>
                  <span style="font-weight: bold;">${order.shippingAddress.method}</span>
                </div>
              </div>

              <p>We will notify you once your order is dispatched.</p>
              
              <div style="text-align: center; margin-top: 30px;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" style="background-color: #333; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 14px;">View Order</a>
              </div>
            </div>
            <div style="background-color: #fafafa; padding: 20px; text-align: center; font-size: 12px; color: #999;">
              <p>&copy; ${new Date().getFullYear()} JAANMAK. All rights reserved.</p>
            </div>
          </div>
        `;

        await sendEmail({
          to: order.user.email,
          bcc: process.env.JAANMAK_EMAIL || process.env.EMAIL_USER,
          subject: `Order Confirmed: #${order._id}`,
          html: message
        });
      } catch (error) {
        console.error("Failed to send confirmation email", error);
      }

      res.json(updatedOrder);
    } else {
      res.status(400);
      throw new Error('Payment verification failed');
    }
  } catch (error) {
    console.error(error);
    res.status(500);
    throw new Error('Payment verification failed on server');
  }
});

// @desc    Cancel Order (User)
// @route   PUT /api/orders/:id/cancel
// @access  Private
const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email');

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  // Ensure the user owns the order
  if (order.user._id.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized to cancel this order');
  }

  // Only allow cancellation if still processing
  if (order.status !== 'Processing') {
    res.status(400);
    throw new Error(`Cannot cancel order that is already ${order.status}`);
  }

  order.status = 'Cancelled';
  const updatedOrder = await order.save();

  // Send Cancellation Email
  try {
    const message = `
       <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #ffebee; border-radius: 15px; overflow: hidden;">
         <div style="background-color: #ffebee; padding: 30px; text-align: center;">
           <h2 style="color: #c62828; margin: 0; font-family: 'Playfair Display', serif;">Order Cancelled</h2>
         </div>
         <div style="padding: 30px;">
           <p>Hello <strong>${order.user.name}</strong>,</p>
           <p>Your order <strong>#${order._id}</strong> has been cancelled as requested.</p>
           
           <div style="background-color: #fff; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid #ffebee; text-align: center;">
             <p style="margin: 0; color: #c62828;">The order has been successfully cancelled.</p>
           </div>

           <p style="font-size: 14px; color: #666;">If you have any questions regarding your refund (minus the 10% processing fee), please contact our support team.</p>
         </div>
         <div style="background-color: #fafafa; padding: 20px; text-align: center; font-size: 12px; color: #999;">
           <p>&copy; ${new Date().getFullYear()} JAANMAK. All rights reserved.</p>
         </div>
       </div>
     `;
    await sendEmail({
      to: order.user.email,
      bcc: process.env.JAANMAK_EMAIL || process.env.EMAIL_USER,
      subject: `Order Cancelled: #${order._id}`,
      html: message
    });
  } catch (error) {
    console.error("Failed to send cancellation email", error);
  }

  res.json(updatedOrder);
});

export { addOrderItems, getOrderById, getMyOrders, getOrders, updateOrderStatus, verifyOrderPayment, cancelOrder };