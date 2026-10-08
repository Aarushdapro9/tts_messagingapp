import mongoose from 'mongoose';

const mongoDBConnect = async () => {
  try {
    await mongoose.connect(process.env.URL, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
    });
    console.log("MongoDB - Connected");
  } catch (error) {
    console.error("Error - MongoDB Connection " + error.message);
    throw error;
  }
};
export default mongoDBConnect;
