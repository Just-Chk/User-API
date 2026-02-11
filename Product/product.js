const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const app = express();
app.use(express.json());

const config = require('./config');
const uri = config.mongodbUri;       

const client = new MongoClient(uri);

const dbName = "day-14";
const collectionName = "products";

let db, productsCollection;

async function connectToMongoDB() 
{
    try 
    {
        await client.connect();
        console.log("Connected to MongoDB Atlas");
        db = client.db(dbName);
        productsCollection = db.collection(collectionName);
        
        // Create index on name field for better query performance
        await productsCollection.createIndex({ name: 1 }, { unique: true });
        
        // Check if we need to seed initial data
        const count = await productsCollection.countDocuments();
        if (count === 0) 
        {
            await seedInitialData();
        }
    } 
    
    catch (error) 
    {
        console.error("MongoDB connection error:", error.message);
        process.exit(1);
    }
}

async function seedInitialData() 
{
    try 
    {
        const initialProducts = 
        [
            { name: 'Laptop', price: 999.99, category: 'Electronics' },
            { name: 'T-Shirt', price: 19.99, category: 'Clothing' },
            { name: 'Coffee Mug', price: 12.50, category: 'Home & Kitchen' }
        ];
        
        await productsCollection.insertMany(initialProducts);
        console.log("Initial products seeded to MongoDB");
    } 
    
    catch (error) 
    {
        console.error("Error seeding initial data:", error.message);
    }
}

connectToMongoDB();

app.get('/products', async (req, res) => 
{
    try 
    {
        const products = await productsCollection.find().toArray();
        res.json(products);
    } 
    
    catch (error) 
    {
        console.error("Error fetching products:", error.message);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

app.get('/products/:name', async (req, res) => 
{
    try 
    {
        const product = await productsCollection.findOne({ name: req.params.name });
        if (product) 
        {
            res.json(product);
        } 
        
        else 
        {
            res.status(404).json({ error: 'Product not found' });
        }
    } 
    
    catch (error) 
    {
        console.error("Error fetching product:", error.message);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

app.post('/products', async (req, res) => 
{
    try 
    {
        const { name, price, category } = req.body;
        
        if (!name || !price || !category) 
        {
            return res.status(400).json({ error: 'Name, price and category are required' });
        }
        
        const existingProduct = await productsCollection.findOne({ name: name });
        if (existingProduct) 
        {
            return res.status(400).json({ error: 'Product with this name already exists' });
        }
        
        const newProduct = 
        {
            name,
            price,
            category,
            createdAt: new Date()
        };
        
        await productsCollection.insertOne(newProduct);
        res.status(201).json(newProduct);
    } 
    
    catch (error) 
    {
        console.error("Error creating product:", error.message);
        if (error.code === 11000) 
        {
            res.status(400).json({ error: 'Duplicate product name' });
        } 
        
        else 
        {
            res.status(500).json({ error: 'Failed to create product' });
        }
    }
});

app.put('/products/:name', async (req, res) => 
{
    try 
    {
        const productName = req.params.name;
        const { name, price, category } = req.body;
        
        const existingProduct = await productsCollection.findOne({ name: productName });
        if (!existingProduct) 
        {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        if (name && name !== productName) 
        {
            const nameExists = await productsCollection.findOne({ 
                name: name, 
                _id: { $ne: existingProduct._id } 
            });
            if (nameExists) 
            {
                return res.status(400).json({ error: 'Product name already in use by another product' });
            }
        }
        
        const updateData = { ...req.body };
        
        const result = await productsCollection.updateOne(
            { name: productName },
            { $set: updateData }
        );
        
        if (result.modifiedCount > 0 || result.matchedCount > 0) 
        {
            const updatedProduct = await productsCollection.findOne({ name: name || productName });
            res.json(updatedProduct);
        } 
        
        else 
        {
            res.status(400).json({ error: 'No changes made' });
        }
    } 
    
    catch (error) 
    {
        console.error("Error updating product:", error.message);
        if (error.code === 11000) 
        {
            res.status(400).json({ error: 'Product name already exists' });
        } 
        else 
        {
            res.status(500).json({ error: 'Failed to update product' });
        }
    }
});

app.delete('/products/:name', async (req, res) => 
{
    try 
    {
        const productName = req.params.name;
        
        const existingProduct = await productsCollection.findOne({ name: productName });
        if (!existingProduct) 
        {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        const result = await productsCollection.deleteOne({ name: productName });
        
        if (result.deletedCount > 0) 
        {
            res.json({ message: 'Product deleted successfully' });
        } 
        
        else 
        {
            res.status(500).json({ error: 'Failed to delete product' });
        }
    } 
    
    catch (error) 
    {
        console.error("Error deleting product:", error.message);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

process.on('SIGINT', async () => 
{
    await client.close();
    console.log('MongoDB connection closed');
    process.exit(0);
});

app.listen(3000, () => console.log('Server: http://localhost:3000'));