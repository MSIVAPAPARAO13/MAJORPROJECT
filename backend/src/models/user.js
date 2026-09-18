const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose');
const UserSchema = new Schema({
 
  email: {
    type: String,
    required: true,
    unique: true
  },
  role: {
    type: String,
    enum: ['ADMIN', 'OWNER', 'MANAGER', 'STAFF', 'CUSTOMER'],
    default: 'CUSTOMER'
  },
  organization: {
    type: Schema.Types.ObjectId,
    ref: 'Organization'
  },
  phone: {
    type: String
  },
  avatar: {
    type: String
  }
}, { timestamps: true });
UserSchema.plugin(passportLocalMongoose);
module.exports = mongoose.model('User', UserSchema);