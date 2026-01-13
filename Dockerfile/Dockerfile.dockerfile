# Step 1: Use the lightweight Nginx Alpine image
FROM nginx:alpine

# Step 2: Copy your HTML, CSS, and JS files into the Nginx server folder
# This assumes your main file is index.html in the root directory
COPY . /usr/share/nginx/html

# Step 3: Expose port 80 (standard for web traffic)
EXPOSE 80

# Step 4: Start Nginx (handled automatically by the base image)