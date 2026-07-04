const mongoose =require('mongoose');


const saleSchema=new mongoose.Schema({
    product:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
        
    },
    productName: {
    type: String
    
    },
       category:{
        type:String
        
    },
    quantity:{
        type:Number
        
    },
    costAtSale:{
        type:Number
},
    items:[
        {
            product:{
                type: mongoose.Schema.Types.ObjectId,
                ref:"Product"
            },
            productName:String,
            category:String,
            quantity:Number,
            costAtSale:Number,
            priceAtSale:Number,
            subtotal:Number
        }
    ],
    total:{
        type:Number,
        required:true
    },
    shopId: {
        type: String,
        required: true
    },
     createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
    
},{timestamps:true});
module.exports=mongoose.model("Sale",saleSchema);