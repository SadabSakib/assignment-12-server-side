const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
var jwt = require("jsonwebtoken");
// var token = jwt.sign({ foo: "bar" }, "shhhhh");
const app = express();
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRETE_KEY);

app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const verifytoken = (req, res, next) => {
  console.log("inside the verifytoken");
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  console.log("token inside the verifyToken", token);
  jwt.verify(token, process.env.JWT_SECRETE, (err, decoded) => {
    if (err) {
      return res.status(401).send({
        message: "unauthorized access",
      });
    }
    req.user = decoded;
    // Attach decoded user information to req.user
    next();
    // // Continue to the next middleware or route handler
  });
};

console.log(process.env.DB_USER);
console.log(process.env.DB_PASS);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2b6ta.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const coffeeCollection = client.db("coffeeDB").collection("coffee");

    // below two r needed for assignment
    const visaCollection = client.db("visaDB").collection("visa");
    const userCollection = client.db("userDB").collection("users");
    const appliedVisaCollection = client
      .db("appliedVisaDB")
      .collection("appliedVisa");
    const paymentCollection = client.db("appliedVisaDB").collection("payments");
    const packageCollection = client
      .db("packageCollection")
      .collection("packages");
    const tourGuidesCollection = client
      .db("tourGuidesCollection")
      .collection("tourGuides");
    const storyCollection = client.db("stories").collection("storyCollection");

    const verifyAdmin = async (req, res, next) => {
      const email = req.user.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    // const verifyTourGuide = async (req, res, next) => {
    //   const email = req.user.email;
    //   const query = { email: email };
    //   const user = await userCollection.findOne(query);
    //   const isAdmin = user?.role === "admin";
    //   if (!isAdmin) {
    //     return res.status(403).send({ message: "forbidden access" });
    //   }
    //   next();
    // };

    // auth related apis
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRETE, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: false,
        })
        .send({ success: true });
      // res.send(token);
    });

    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: false,
        })
        .send({ success: true });
    });

    // tour assginment 12 related
    app.get("/api/packages/random", async (req, res) => {
      const packages = await packageCollection.find().toArray();
      res.json(packages);
    });
    // app.get("/api/packages/random", async (req, res) => {
    //   const packages = await packageCollection
    //     .aggregate([{ $sample: { size: 3 } }])
    //     .toArray();
    //   res.json(packages);
    // });
    app.get("/api/tour-guides/random", async (req, res) => {
      const tourGuides = await tourGuidesCollection
        .aggregate([{ $sample: { size: 6 } }])
        .toArray();
      res.json(tourGuides);
    });

    app.post("/story", async (req, res) => {
      const newStory = req.body;
      console.log(newStory);
      const result = await storyCollection.insertOne(newStory);
      res.send(result);
    });

    app.get("/api/stories", async (req, res) => {
      const stories = await storyCollection.find().toArray();
      res.json(stories);
    });
    app.get("/package/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await packageCollection.findOne(query);
      res.send(result);
    });
    app.get("/tour-guide/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await tourGuidesCollection.findOne(query);
      res.send(result);
    });

    // Endpoint to remove an image from a story
    // app.patch("/api/stories/:id/remove-image", async (req, res) => {
    //   const { id } = req.params;
    //   const { imageUrl } = req.body;
    //   const result = await storiesCollection.updateOne(
    //     { _id: ObjectId(id) },
    //     { $pull: { images: imageUrl } }
    //   );
    //   res.json(result);
    // });
    // Endpoint to update a story
    app.put("/api/stories/:id", async (req, res) => {
      const { id } = req.params;
      const { title, text, images } = req.body;
      const updateStory = { title, text, images };
      const result = await storyCollection.updateOne(
        { _id: ObjectId(id) },
        { $set: updateStory }
      );
      res.json(result);
    });

    // Endpoint to add new images to a story
    app.patch("/api/stories/:id/images", async (req, res) => {
      const { id } = req.params;
      const { images } = req.body;
      const result = await storyCollection.updateOne(
        { _id: ObjectId(id) },
        { $push: { images: { $each: images } } }
      );
      res.json(result);
    });

    // Endpoint to remove an image from a story
    app.patch("/api/stories/:id/remove-image", async (req, res) => {
      const { id } = req.params;
      const { imageUrl } = req.body;
      const result = await storyCollection.updateOne(
        { _id: ObjectId(id) },
        { $pull: { images: imageUrl } }
      );
      res.json(result);
    });
    // Endpoint to delete a story
    app.delete("/api/stories/:id", async (req, res) => {
      const { id } = req.params;
      const result = await storyCollection.deleteOne({ _id: ObjectId(id) });
      res.json(result);
    });















    // visa related apis
    app.get("/visas", async (req, res) => {
      const cursor = visaCollection.find();
      const result = await cursor.toArray();
      res.send(result);
      console.log(result);
    });
    app.post("/visas", verifytoken, verifyAdmin, async (req, res) => {
      const newVisa = req.body;
      console.log(newVisa);
      const result = await visaCollection.insertOne(newVisa);
      res.send(result);
    });

    // payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parent(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.get("/payments/:email", verifytoken, async (req, res) => {
      const query = { email: req.params.email };
      if (req.params.email !== req.user.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      console.log("payment info", payment);
      const paymentResult = await paymentCollection.insertOne(payment);
      const query = {
        _id: {
          $in: payment.cartIds.map((id) => new ObjectId(id)),
        },
      };
      const deleteResult = await appliedVisaCollection.deleteMany(query);
      res.send({ paymentResult, deleteResult });
    });

    // stats or analytics
    app.get("/admin-stats", verifytoken, verifyAdmin, async (req, res) => {
      const usersCount = await userCollection.estimatedDocumentCount();
      const myVisaApplication =
        await appliedVisaCollection.estimatedDocumentCount();
      const orders = paymentCollection.estimatedDocumentCount();
      const result = await paymentCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: "$price",
              },
            },
          },
        ])
        .toArray();

      const revenue = result.length > 0 ? result[0].totalRevenue : 0;
      res.send({
        usersCount,
        myVisaApplication,
        orders,
        revenue,
      });
    });

    // nicher eta nia kaj korte hbe
    app.get("/applyvisa/:userEmail", verifytoken, async (req, res) => {
      const email = req.params.userEmail;
      const query = { email: email };
      if (req.user.email !== email) {
        return res
          .status(403)
          .send({ message: "forbidden accees dure giya mor" });
      }
      const cursor = appliedVisaCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    app.post("/applyVisas", async (req, res) => {
      const newAppliedVisa = req.body;
      console.log(newAppliedVisa);
      console.log(req.cookies);
      const result = await appliedVisaCollection.insertOne(newAppliedVisa);
      res.send(result);
    });
    app.delete("/myVisaApplication/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await appliedVisaCollection.deleteOne(query);
      res.send(result);
    });

    // for searching
    app.get("/search", async (req, res) => {
      const query = req.query.q;
      const visas = await visaCollection
        .find({ countryName: { $regex: query, $options: "i" } })
        .toArray();
      res.json(visas);
    });

    app.get("/visa/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await visaCollection.findOne(query);
      res.send(result);
    });
    app.get("/visas/:userEmail", verifytoken, async (req, res) => {
      const email = req.params.userEmail;
      const query = { email: email };
      if (req.user.email !== email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const cursor = visaCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    app.put("/visa/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedVisas = req.body;

      const visa = {
        $set: {
          countryImage: updatedVisas.countryImage,
          countryName: updatedVisas.countryName,
          visaType: updatedVisas.visaType,
          processingTime: updatedVisas.processingTime,
          requiredDocuments: updatedVisas.requiredDocuments,
          description: updatedVisas.description,
          ageRestriction: updatedVisas.ageRestriction,
          fee: updatedVisas.fee,
          validity: updatedVisas.validity,
          applicationMethod: updatedVisas.applicationMethod,
          email: updatedVisas.email,
        },
      };
      const result = await visaCollection.updateOne(filter, visa, options);
      res.send(result);
    });

    app.delete("/visa/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await visaCollection.deleteOne(query);
      res.send(result);
    });

    // cofee
    app.get("/coffee", async (req, res) => {
      const cursor = coffeeCollection.find();
      const result = await cursor.toArray();
      res.send(result);
      console.log(result);
    });
    app.get("/coffee/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await coffeeCollection.findOne(query);
      res.send(result);
    });
    app.post("/coffee", async (req, res) => {
      const newCoffee = req.body;
      console.log(newCoffee);
      const result = await coffeeCollection.insertOne(newCoffee);
      res.send(result);
    });

    app.put("/coffee/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedCoffee = req.body;

      const coffee = {
        $set: {
          name: updatedCoffee.name,
          chef: updatedCoffee.chef,
          supplier: updatedCoffee.supplier,
          taste: updatedCoffee.taste,
          category: updatedCoffee.category,
          details: updatedCoffee.details,
          photo: updatedCoffee.photo,
        },
      };
      const result = await coffeeCollection.updateOne(filter, coffee, options);
      res.send(result);
    });

    app.delete("/coffee/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await coffeeCollection.deleteOne(query);
      res.send(result);
    });
    app.path("/coffee/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await coffeeCollection.deleteOne(query);
      res.send(result);
    });

    // Users related apis
    app.get(
      "/user/admin/:email",
      verifytoken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const query = { email: email };
        if (req.user.email !== email) {
          return res
            .status(403)
            .send({ message: "forbidden accees dure giya mor" });
        }
        const user = await userCollection.findOne(query);
        // let admin = false
        if (user) {
          console.log(user?.role);
          user?.role === "admin"
            ? res.send({ admin: true })
            : res.send({ admin: false });
        }
      }
    );
    app.patch(
      "/users/admin/:id",
      verifytoken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(query, updatedDoc);
        res.send(result);
      }
    );
    app.get("/users", verifytoken, verifyAdmin, async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
      console.log(req.cookies);
    });
    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const existingUser = await userCollection.findOne({
        email: newUser.email,
      });
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });

    app.patch("/users", async (req, res) => {
      const email = req.body.email;
      const filter = { email };
      const updatedLoginTime = {
        $set: {
          lastSignInTime: req.body?.lastSignInTime,
        },
      };
      const result = await userCollection.updateOne(filter, updatedLoginTime);
      res.send(result);
    });

    app.delete("/users/:id", verifytoken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("ghjhhjkk");
});
app.listen(port, () => {
  console.log(`jknkj at ${port}`);
});
