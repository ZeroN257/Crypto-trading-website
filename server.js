const express = require('express');
const cors = require('cors');
const path = require('path');
const neo4j = require('neo4j-driver');

// Neo4j connection details
const uri = 'bolt://localhost';
const user = 'neo4j';
const password = '12345678';

// Create a Neo4j driver instance
const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
const session = driver.session();

const app = express();

// Enable all CORS requests
app.use(cors());

// Serve static files from the root directory
app.use(express.static('public'));


// API endpoint for wallet details
app.get('/api/wallet/:address', async (req, res) => {
  const { address } = req.params;
  const session = driver.session();
  try {
    const result = await session.run(
      'MATCH (wallet {addressId: $address}) RETURN wallet.addressId AS addressId, wallet.type AS type, wallet.btc AS btc, wallet.eth AS eth',
      { address }
    );
    const walletInfo = result.records.map(record => {
      return {
        addressId: record.get('addressId'),
        type: record.get('type'),
        btc: record.get('btc'),
        eth: record.get('eth')
      };
    });
    console.log(walletInfo);
    res.json(walletInfo);
  } catch (error) {
    console.error('Error accessing the database:', error);
    res.status(500).send('Database access error');
  } finally {
    await session.close();
  }
});
// API endpoint for address transaction
app.get('/api/wallet/:address/transactions', async (req, res) => {
  const { address } = req.params;
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (a:Address {addressId: $address})-[r:TRANSACTION]-(b:Address)
       RETURN r.hash AS hash, 
              r.value AS value, 
              r.input AS input, 
              r.transaction_index AS transaction_index, 
              r.gas AS gas, 
              r.gas_used AS gas_used, 
              r.gas_price AS gas_price, 
              r.transaction_fee AS transaction_fee, 
              r.block_number AS block_number, 
              r.block_hash AS block_hash, 
              r.block_timestamp AS block_timestamp,
              startNode(r).addressId AS from_address,
              endNode(r).addressId AS to_address`,
      { address }
    );

    const transactions = result.records.map(record => {
      return {
        hash: record.get('hash'),
        value: record.get('value'),
        input: record.get('input'),
        transaction_index: record.get('transaction_index').low, // Use .low for Neo4j integer
        gas: record.get('gas').low, // Use .low for Neo4j integer
        gas_used: record.get('gas_used').low, // Use .low for Neo4j integer
        gas_price: neo4j.integer.toNumber(record.get('gas_price')), // Convert Neo4j integer to JavaScript number
        transaction_fee: record.get('transaction_fee'),
        block_number: record.get('block_number').low, // Use .low for Neo4j integer
        block_hash: record.get('block_hash'),
        block_timestamp: record.get('block_timestamp').low, // Use .low for Neo4j integer
        from_address: record.get('from_address'), // Added: Fetch from_address
        to_address: record.get('to_address') // Added: Fetch to_address
      };
    });
    
    res.json(transactions);
  } catch (error) {
    console.error('Error accessing the database:', error);
    res.status(500).send('Database access error');
  } finally {
    await session.close();
  }
});


// Catch-all route to serve the front-end
app.get('*', (req, res) => {
  res.sendFile(path.resolve('public', 'index.html'));
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Close Neo4j driver upon exit
process.on('exit', () => {
  driver.close();
});

