const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const app = express();
app.use(express.json());

const config = require('./config');
const uri = config.mongodbUri;       

const client = new MongoClient(uri);

const dbName = "day-14";
const collectionName = "user-api";

let usersCollection;

async function connectDB() 
{
    try 
    {
        await client.connect();
        console.log("Connected to MongoDB");
        const db = client.db(dbName);
        usersCollection = db.collection(collectionName);
        
        await usersCollection.createIndex({ id: 1 }, { unique: true });
        
        const count = await usersCollection.countDocuments();
        if (count === 0) 
        {
            await seedData();
        }
    } 
    
    catch (error) 
    {
        console.error("MongoDB connection error:", error.message);
        process.exit(1);
    }
}

async function seedData() 
{
    try 
    {
        const users = [
            { id: 1, name: 'Rahul', email: 'rahul@example.com', age: 25, isActive: true },
            { id: 2, name: 'Aditi', email: 'aditi@example.com', age: 30, isActive: true },
            { id: 3, name: 'Priya', email: 'priya@example.com', age: 22, isActive: false },
            { id: 4, name: 'Amit', email: 'amit@example.com', age: 35, isActive: true },
            { id: 5, name: 'Sneha', email: 'sneha@example.com', age: 28, isActive: false }
        ];
        
        await usersCollection.insertMany(users);
        console.log("Initial users seeded");
    } 
    
    catch (error) 
    {
        console.error("Error seeding data:", error.message);
    }
}

async function getNextId() 
{
    const lastUser = await usersCollection.find().sort({ id: -1 }).limit(1).toArray();
    return lastUser.length > 0 ? lastUser[0].id + 1 : 1;
}

connectDB();

app.get('/users', async (req, res) => 
{
    try 
    {
        const query = req.query.active ? { isActive: req.query.active === 'true' } : {};
        const users = await usersCollection.find(query).toArray();
        res.json(users);
    } 
    
    catch (error) 
    {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.get('/users/active', async (req, res) => 
{
    try 
    {
        const users = await usersCollection.find({ isActive: true }).toArray();
        res.json(users);
    } 
    
    catch (error) 
    {
        res.status(500).json({ error: 'Failed to fetch active users' });
    }
});

app.get('/users/age/:minAge', async (req, res) => 
{
    try 
    {
        const minAge = parseInt(req.params.minAge);
        if (isNaN(minAge)) 
        {
            return res.status(400).json({ error: 'Invalid age' });
        }

        const query = { age: { $gt: minAge } };
        if (req.query.active === 'true') 
        {
            query.isActive = true;
        }

        const users = await usersCollection.find(query).toArray();
        res.json({
            count: users.length,
            users: users
        });
    } 
    
    catch (error) 
    {
        res.status(500).json({ error: 'Failed to fetch users by age' });
    }
});

app.get('/users/:id', async (req, res) => 
{
    try 
    {
        const user = await usersCollection.findOne({ id: parseInt(req.params.id) });
        user ? res.json(user) : res.status(404).json({ error: 'User not found' });
    } 
    
    catch (error) 
    {
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

app.post('/users', async (req, res) => 
{
    try 
    {
        const { name, email, age } = req.body;
        
        if (!name || !email) 
        {
            return res.status(400).json({ error: 'Name and email required' });
        }

        const nextId = await getNextId();
        const newUser = {
            id: nextId,
            name,
            email,
            age: age || 0,
            isActive: true,
            createdAt: new Date()
        };

        await usersCollection.insertOne(newUser);
        res.status(201).json(newUser);
    } 
    
    catch (error) 
    {
        if (error.code === 11000) 
        {
            res.status(400).json({ error: 'Duplicate ID' });
        } 
        
        else 
        {
            res.status(500).json({ error: 'Failed to create user' });
        }
    }
});

app.put('/users/:id', async (req, res) => 
{
    try 
    {
        const userId = parseInt(req.params.id);
        const user = await usersCollection.findOne({ id: userId });
        
        if (!user) 
        {
            return res.status(404).json({ error: 'User not found' });
        }

        const updateData = { ...req.body };
        delete updateData.id;

        const result = await usersCollection.updateOne(
            { id: userId },
            { $set: updateData }
        );

        if (result.matchedCount === 0) 
        {
            return res.status(404).json({ error: 'User not found' });
        }

        const updatedUser = await usersCollection.findOne({ id: userId });
        res.json(updatedUser);
    } 
    
    catch (error) 
    {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

app.patch('/users/:id/toggle-active', async (req, res) => {
    try 
    {
        const userId = parseInt(req.params.id);
        const user = await usersCollection.findOne({ id: userId });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const newStatus = !user.isActive;
        await usersCollection.updateOne(
            { id: userId },
            { $set: { isActive: newStatus } }
        );

        res.json({ 
            message: `User ${newStatus ? 'activated' : 'deactivated'}`,
            isActive: newStatus 
        });
    } 
    
    catch (error) 
    {
        res.status(500).json({ error: 'Failed to toggle status' });
    }
});

app.delete('/users/:id', async (req, res) => 
{
    try 
    {
        const userId = parseInt(req.params.id);
        const result = await usersCollection.deleteOne({ id: userId });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ message: 'User deleted successfully' });
    } 
    
    catch (error) 
    {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

process.on('SIGINT', async () => 
{
    await client.close();
    console.log('MongoDB connection closed');
    process.exit(0);
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));