require("dotenv").config();
const express = require("express");
const mongooes = require("mongoose");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const PDFDocument = require("pdfkit");
const fs=require("fs");
const authMiddleware = require("./middleware/auth");
const roleMiddleware = require("./middleware/role");
const verifyMiddleware = require("./middleware/verify");
const generateInvoice = require("./utils/generateInvoice");
const app = express();
const Product = require("./models/Product");
const Sale = require("./models/Sale");
app.use(express.json());
app.use(express.static("public"));
app.use("/invoices", express.static("invoices"));
mongooes
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));
app.get("/", (req, res) => {
  res.send("API Inventry Running");
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


app.post("/register", async (req, res) => {
  try {
    const { name, email, password, shopId } = req.body;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).send("Invalid email format");
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).send("User already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

   const token = crypto.randomBytes(32).toString("hex");

const user = new User({
  name,
  email,
  password: hashedPassword,
  role: "owner",
  shopId,

  isVerified: false,
  verificationToken: token,
  verificationExpires: Date.now() + 10 * 60 * 1000
});

    await user.save();

    const link = `https://reliably-vagabond-crock.ngrok-free.dev/verify/${token}`;

await transporter.sendMail({
  to: email,
  subject: "Verify your account",
  html: `
    <h3>Hello ${name}</h3>
    <p>Click below to verify your account:</p>
    <a href="${link}">Verify Account</a>
    <p>This link expires in 10 minutes</p>
  `
});

    res.send("User registered");
  } catch (err) {
    console.log("Register error:", err);
    res.status(500).json({
      message: err.message,
    });
  }
});

app.get("/verify/:token", async (req, res) => {
  try {
    const user = await User.findOne({
      verificationToken: req.params.token,
      verificationExpires: { $gt: Date.now() } 
    });

    if (!user) {

 
  const alreadyVerified = await User.findOne({
    verificationToken: undefined
  });

  if (alreadyVerified) {
    return res.send("✅ Email already verified. You can login.");
  }

  return res.send("❌ Token invalid or expired");
}

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationExpires = undefined;

    await user.save();

    res.send("✅ Email verified successfully. You can now login.");

  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

   const user = await User.findOne({ email });

if (!user) {
  return res.status(400).json({ message: "User not found" });
}

if (!user.isVerified) {
  return res.status(403).json({
    message: "Please verify your email first"
  });
}

    
    if (user.isActive === false) {
      return res.status(403).json({
        message: "Your account has been deactivated",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        shopId: user.shopId,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/register-staff", authMiddleware, roleMiddleware("owner"), async (req, res) => {

    const { name, email, password } = req.body;

    const existing = await User.findOne({
        email,
        shopId: req.user.shopId
    });

    
    if (existing && !existing.isVerified) {
        return res.send("User already registered. Please check email to verify.");
    }

    
    if (existing && existing.isActive === false) {

        const token = crypto.randomBytes(32).toString("hex");

        existing.isActive = true;
        existing.isVerified = false;
        existing.verificationToken = token;
        existing.verificationExpires = Date.now() + 10 * 60 * 1000;

        existing.name = name;
        existing.password = await bcrypt.hash(password, 10);

        await existing.save();

        const link = `https://reliably-vagabond-crock.ngrok-free.dev/verify/${token}`;

        await transporter.sendMail({
            to: email,
            subject: "Verify your account",
            html: `
                <h3>Hello ${name}</h3>
                <p>Click below to verify your account:</p>
                <a href="${link}">Verify Account</a>
            `
        });

        return res.send("Staff reactivated. Verification email sent.");
    }


    if (existing) {
        return res.send("User already exists");
    }


    const hashedPassword = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(32).toString("hex");

    const newStaff = new User({
        name,
        email,
        password: hashedPassword,
        role: "staff",
        shopId: req.user.shopId,

        isVerified: false,
        verificationToken: token,
        verificationExpires: Date.now() + 10 * 60 * 1000
    });

    await newStaff.save();

    const link = `https://reliably-vagabond-crock.ngrok-free.dev/verify/${token}`;

    await transporter.sendMail({
        to: email,
        subject: "Verify your account",
        html: `
            <h3>Hello ${name}</h3>
            <p>Click below to verify your account:</p>
            <a href="${link}">Verify Account</a>
            <p>This link expires in 10 minutes</p>
        `
    });

    res.send("Staff created. Verification email sent.");
});

app.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).send("User not found");
    }

    if (user.isVerified) {
      return res.send("User already verified");
    }

    const token = crypto.randomBytes(32).toString("hex");

    user.verificationToken = token;
    user.verificationExpires = Date.now() + 10 * 60 * 1000;

    await user.save();

    const link = `https://reliably-vagabond-crock.ngrok-free.dev/verify/${token}`;

    await transporter.sendMail({
      to: email,
      subject: "Resend Verification",
      html: `
        <h3>Hello ${user.name}</h3>
        <p>Click below to verify your account:</p>
        <a href="${link}">Verify Account</a>
        <p>This link expires in 10 minutes</p>
      `
    });

    res.send("Verification email resent");

  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post(
  "/add-product",
  authMiddleware,
  verifyMiddleware,
  async (req, res, next) => {

    const user = await User.findById(req.user.userId);

    if (user.role === "owner") {
        return next();
    }

    if (
        user.role === "staff" &&
        user.permissions?.canAddProduct
    ) {
        return next();
    }

    return res.status(403).send("Permission denied");
},
  async (req, res) => {
    try {
      const data = req.body;
      data.shopId = req.user.shopId;

      data.model = data.model.toLowerCase().trim();
      data.category = data.category.toLowerCase().trim();

      const existing = await Product.findOne({
        model: data.model,
        category: data.category,
        shopId: req.user.shopId,
      });

      if (existing) {
        return res
          .status(400)
          .send(`${data.model} (${data.category}) already exists`);
      }

      const newProduct = new Product(data);
      await newProduct.save();

      res.send("Product added");
    } catch (err) {
      res.status(500).send(err.message);
    }
  },
);

app.post(
  "/add-products",
  authMiddleware,
  verifyMiddleware,
  async (req, res, next) => {

    const user = await User.findById(req.user.userId);

    if (user.role === "owner") {
        return next();
    }

    if (
        user.role === "staff" &&
        user.permissions?.canAddProduct
    ) {
        return next();
    }

    return res.status(403).send("Permission denied");
},
  async (req, res) => {
    try {
      const products = req.body;

      let added = 0;
      let duplicateList = [];

      for (let p of products) {
        p.model = p.model.toLowerCase().trim();
        p.category = p.category.toLowerCase().trim();
        p.shopId = req.user.shopId;
        const existing = await Product.findOne({
          model: p.model,
          category: p.category,
          shopId: req.user.shopId,
        });

        if (existing) {
          duplicateList.push(`${p.model} (${p.category})`);
          continue;
        }

        const newProduct = new Product(p);
        await newProduct.save();
        added++;
      }

      res.json({
        added,
        duplicates: duplicateList,
      });
    } catch (err) {
      res.status(500).send(err.message);
    }
  },
);

app.get(
  "/products",
  authMiddleware,
  roleMiddleware("owner", "staff"),
  async (req, res) => {
    try {
      const products = await Product.find({
        shopId: req.user.shopId,
      });
      res.json(products);
    } catch (err) {
      res.status(500).send(err.message);
    }
  },
);
app.put(
  "/products/:id",
  authMiddleware,
  roleMiddleware("owner"),
  async (req, res) => {
    try {
      const updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        { stock: req.body.stock },
        { returnDocument: "after" },
      );
      res.json(updatedProduct);
    } catch (err) {
      res.status(500).send(err.message);
    }
  },
);

app.delete(
  "/products/:id",
  authMiddleware,
  roleMiddleware("owner"),
  async (req, res) => {
    try {
      const deleteProduct = await Product.findByIdAndDelete(req.params.id);
      res.send("Product deleted successfully");
    } catch (err) {
      res.status(500).send(err.message);
    }
  },
);
app.post(
  "/sell",
  authMiddleware,
  verifyMiddleware,
  roleMiddleware("owner", "staff"),
  async (req, res) => {
    
    const { productId, quantity } = req.body;

    const product = await Product.findOne({
      _id: productId,
      shopId: req.user.shopId,
    });
    if (!product) {
      return res.status(404).send("Product Not Found!");
    }

    if (product.stock < quantity) {
      return res.status(400).send("Not enough product");
    }
    product.stock -= quantity;
    await product.save();
    const total = product.price * quantity;
    const saleItems = [
  {
    productName: product.model,
    quantity: quantity,
    priceAtSale: product.price,
    subtotal: total,
  },
];
    const sale = new Sale({
      product: product._id,
      productName: product.model,
      category: product.category,
      quantity: quantity,
      total: total,
      shopId: req.user.shopId,

      createdBy: req.user.userId,
    });
    await sale.save();
    const user = await User.findById(req.user.userId);

    const fileName = generateInvoice(
  saleItems,
  total,
  user
);
res.json({
  message: "Sale recorded successfully",
  invoice: fileName,
});  },
);
app.get("/sales", authMiddleware, roleMiddleware("owner"), async (req, res) => {
  const sales = await Sale.find({
    shopId: req.user.shopId,
  })
    .populate("product")
    .sort({ createdAt: -1 });

  res.json(sales);
});
app.get(
  "/summary",
  authMiddleware,
  roleMiddleware("owner"),
  async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const sales = await Sale.find({
      shopId: req.user.shopId,
      createdAt: {
        $gte: today,
        $lt: tomorrow,
      },
    });
    let todayRevenue = 0;
    let itemsSold = 0;
    let productCount = {};
    sales.forEach((s) => {
      todayRevenue += s.total;
      if (s.items && s.items.length > 0) {
        s.items.forEach((i) => {
          itemsSold += i.quantity;
          let name = `${i.productName} (${i.category})`;

          if (!productCount[name]) {
            productCount[name] = 0;
          }

          productCount[name] += i.quantity;
        });
      } else {
        itemsSold += s.quantity;

        let name = `${s.productName} (${s.category})`;

        if (!productCount[name]) {
          productCount[name] = 0;
        }

        productCount[name] += s.quantity;
      }
    });
    let topProduct = "";
    let temp = 0;
    for (let c in productCount) {
      if (productCount[c] > temp) {
        temp = productCount[c];
        topProduct = c;
      }
    }

    const transactions = sales.length;
    const sortedProducts = Object.entries(productCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topProductCount = Object.fromEntries(sortedProducts);
    res.json({
      todayRevenue,
      itemsSold,
      transactions,
      topProduct: `${topProduct} (${temp} sold)`,
      productCount: topProductCount,
    });
  },
);

app.get(
  "/monthly-revenue",
  authMiddleware,
  roleMiddleware("owner"),
  async (req, res) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const sales = await Sale.find({
      shopId: req.user.shopId,
      createdAt: {
        $gte: startOfMonth,
        $lt: startOfNextMonth,
      },
    });
    let revenueByDay = {};
    sales.forEach((s) => {
      const day = new Date(s.createdAt).getDate();
      if (!revenueByDay[day]) {
        revenueByDay[day] = 0;
      }
      revenueByDay[day] += s.total;
    });
    res.json(revenueByDay);
  },
);

app.get(
  "/low-stock",
  authMiddleware,
  roleMiddleware("owner", "staff"),
  async (req, res) => {
    const products = await Product.find({
      shopId: req.user.shopId,
      stock: { $lte: 5 },
    }).sort({ stock: 1 });

    res.json(products);
  },
);

app.post(
  "/checkout",
  authMiddleware,
  verifyMiddleware,
  roleMiddleware("owner", "staff"),
  async (req, res) => {
    try {
      const { items } = req.body;
      let saleItems = [];
      let total = 0;
      for (let item of items) {
        const product = await Product.findById(item.productId);
        if (!product) {
          return res.status(404).send("Product not found");
        }
        if (product.stock < item.quantity) {
          return res.status(400).send(`${product.model} out of stock`);
        }
        const subtotal = product.price * item.quantity;
        product.stock -= item.quantity;
        await product.save();

        saleItems.push({
          product: product._id,
          productName: product.model,
          category: product.category,
          quantity: item.quantity,
          priceAtSale: product.price,
          subtotal: subtotal,
          shopId: req.user.shopId,
        });
        total += subtotal;
      }
      const sale = new Sale({
        items: saleItems,
        total: total,
        shopId: req.user.shopId,
        createdBy: req.user.userId,
      });
      await sale.save();
      const user = await User.findById(req.user.userId);

const fileName = generateInvoice(
    saleItems,
    total,
    user
);
      res.json({
  message: "Checkout successful",
  invoice: fileName,
});
    } catch (err) {
      res.status(500).send(err.message);
    }
  },
);

app.get("/staff", authMiddleware, roleMiddleware("owner"), async (req, res) => {
  const staff = await User.find({
    role: "staff",
    shopId: req.user.shopId,
    isActive: { $eq: true }   
  }).select("-password");

  res.json(staff);
});
app.put(
  "/staff/permission/:id",
  authMiddleware,
  roleMiddleware("owner"),
  async (req, res) => {

    try {

      const { canAddProduct } = req.body;

const staff = await User.findById(req.params.id);

if (!staff || staff.role !== "staff") {
    return res.status(404).send("Staff not found");
}

await User.findByIdAndUpdate(
    req.params.id,
    {
        $set: {
            "permissions.canAddProduct": canAddProduct
        }
    }
);

res.send("Permission updated");

    } catch (err) {
      res.status(500).send(err.message);
    }
  }
);


app.delete("/staff/:id", authMiddleware, roleMiddleware("owner"), async (req, res) => {
    try {
        const staff = await User.findOne({
            _id: req.params.id,
            shopId: req.user.shopId,
            role: "staff"
        });

        if (!staff) {
            return res.status(404).send("Staff not found");
        }

        // 🔥 SOFT DELETE (IMPORTANT)
        staff.isActive = false;
        await staff.save();

        res.send("Staff removed successfully");

    } catch (err) {
        res.status(500).send(err.message);
    }
});


app.get(
  "/staff-performance",
  authMiddleware,
  roleMiddleware("owner"),
  async (req, res) => {
    const data = await Sale.aggregate([
      {
        $match: {
          shopId: req.user.shopId,
          createdBy: { $exists: true, $ne: null },
        },
      },

      {
        $addFields: {
          createdBy: { $toObjectId: "$createdBy" },
        },
      },

      {
        $group: {
          _id: "$createdBy",
          totalRevenue: { $sum: "$total" },
          totalSales: { $sum: 1 },
        },
      },

      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "staff",
        },
      },

      {
        $unwind: {
          path: "$staff",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
  $project: {
    _id: 0,
    name: {
      $cond: [
        { $eq: ["$staff.isActive", false] },
        { $concat: ["$staff.name", " (Removed)"] },
        "$staff.name"
      ]
    },
    email: "$staff.email",
    totalRevenue: 1,
    totalSales: 1
  }
},
    ]);

    res.json(data);
  },
);

app.get("/me", authMiddleware, async (req, res) => {

    const user = await User.findById(req.user.userId)
        .select("-password");

    res.json(user);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("server running at port", PORT);
});
